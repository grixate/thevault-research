from __future__ import annotations

import argparse
import json
import sys
import tempfile
import wave
from contextlib import contextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any, Iterator

from fastapi.testclient import TestClient

from vault_core.app import create_app
from vault_core.config import Settings, load_settings


class SmokeFailure(RuntimeError):
    pass


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        with _data_dir_context(args.data_dir, args.keep_data_dir) as data_dir:
            report = run_voice_smoke(data_dir, args)
    except SmokeFailure as exc:
        report = {
            "status": "fail",
            "error": str(exc),
            "data_dir": str(args.data_dir.expanduser()) if args.data_dir else None,
        }
        _print_report(report, args.format)
        return 1
    except Exception as exc:
        print(f"Local voice smoke failed unexpectedly: {exc}", file=sys.stderr)
        return 2

    _print_report(report, args.format)
    return 0 if report["status"] == "pass" else 1


def run_voice_smoke(data_dir: Path, args: argparse.Namespace) -> dict[str, Any]:
    settings = _settings_for_data_dir(data_dir)
    audio_path = args.audio_path.expanduser() if args.audio_path else data_dir / "voice-smoke-input.wav"
    if args.audio_path is None:
        _write_silent_wav(audio_path)
    steps: list[dict[str, Any]] = []
    with TestClient(create_app(settings)) as client:
        health = _get(client, "/health")
        _require(health.get("ok") is True, "Core health check failed.")
        steps.append({"id": "health", "status": "pass", "detail": f"Core {health.get('version')} online."})

        voices = _get(client, "/voice/voices")
        _require(any(voice.get("id") == "mock-local-voice" for voice in voices), "Mock local voice is not available.")
        steps.append({"id": "voices", "status": "pass", "detail": f"{len(voices)} voice entries available."})

        transcript = _post(
            client,
            "/voice/transcribe",
            {
                "audio_path": str(audio_path),
                "local_only": True,
                "create_source": True,
                "title": "Voice smoke memo",
            },
        )
        _require(transcript.get("sent_off_device") is False, "Transcription left the device.")
        _require(bool(str(transcript.get("text") or "").strip()), "Transcription returned no text.")
        _require(transcript.get("source_id"), "Transcription did not create a source.")
        _require(transcript.get("audio_asset_id"), "Transcription did not create an audio asset.")
        steps.append(
            {
                "id": "transcribe_audio",
                "status": "pass",
                "detail": f"{transcript.get('provider')} / {transcript.get('model_id')} -> {transcript.get('source_id')}",
            }
        )

        speech = _post(
            client,
            "/voice/synthesize",
            {
                "text": args.text,
                "voice_id": "mock-local-voice",
                "format": "wav",
                "local_only": True,
                "cache": True,
            },
        )
        _require(speech.get("sent_off_device") is False, "Speech synthesis left the device.")
        _require(speech.get("speech_asset_id"), "Speech synthesis did not create a speech asset.")
        _require(Path(str(speech.get("audio_path"))).exists(), "Speech synthesis did not write local audio.")
        steps.append(
            {
                "id": "synthesize_speech",
                "status": "pass",
                "detail": f"{speech.get('provider')} / {speech.get('model_id')} -> {speech.get('speech_asset_id')}",
            }
        )

        audio = _get(client, f"/voice/speech-assets/{speech['speech_asset_id']}/audio")
        _require(str(audio.get("data_url") or "").startswith("data:audio/wav;base64,"), "Speech asset audio is not playable.")
        steps.append({"id": "speech_audio", "status": "pass", "detail": f"{audio.get('size_bytes')} bytes returned."})

        cached = _post(
            client,
            "/voice/synthesize",
            {
                "text": args.text,
                "voice_id": "mock-local-voice",
                "format": "wav",
                "local_only": True,
                "cache": True,
            },
        )
        _require(cached.get("cached") is True, "Repeated speech synthesis did not hit the local cache.")
        _require(cached.get("speech_asset_id") == speech.get("speech_asset_id"), "Cached speech asset id changed.")
        steps.append({"id": "speech_cache", "status": "pass", "detail": "Repeated synthesis reused the cached asset."})

        audio_assets = _get(client, "/voice/audio-assets")
        speech_assets = _get(client, "/voice/speech-assets")
        _require(len(audio_assets) >= 1, "No audio assets were recorded.")
        _require(len(speech_assets) >= 1, "No speech assets were recorded.")
        steps.append(
            {
                "id": "asset_inventory",
                "status": "pass",
                "detail": f"{len(audio_assets)} audio assets / {len(speech_assets)} speech assets.",
            }
        )

    return {"status": "pass", "data_dir": str(data_dir), "audio_path": str(audio_path), "steps": steps}


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run an in-process local voice smoke check against Vault Core.")
    parser.add_argument("--data-dir", type=Path, help="Vault data directory to use. Defaults to a temporary directory.")
    parser.add_argument("--keep-data-dir", action="store_true", help="Keep the temporary data directory after the smoke check.")
    parser.add_argument("--audio-path", type=Path, help="Existing audio file to transcribe. Defaults to a generated silent WAV.")
    parser.add_argument("--text", default="The Vault can speak this note locally.", help="Text used for local speech synthesis.")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format.")
    return parser.parse_args(argv)


def _settings_for_data_dir(data_dir: Path) -> Settings:
    settings = load_settings()
    return replace(settings, data_dir=data_dir.expanduser(), desktop_token=None)


@contextmanager
def _data_dir_context(data_dir: Path | None, keep: bool) -> Iterator[Path]:
    if data_dir:
        resolved = data_dir.expanduser()
        resolved.mkdir(parents=True, exist_ok=True)
        yield resolved
        return
    if keep:
        resolved = Path(tempfile.mkdtemp(prefix="vault-local-voice-smoke-"))
        yield resolved
        return
    with tempfile.TemporaryDirectory(prefix="vault-local-voice-smoke-") as temp_dir:
        yield Path(temp_dir)


def _write_silent_wav(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sample_rate = 16000
    duration_seconds = 0.3
    frames = int(sample_rate * duration_seconds)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * frames)


def _get(client: TestClient, path: str) -> dict[str, Any] | list[Any]:
    response = client.get(path)
    if response.status_code >= 400:
        raise SmokeFailure(f"GET {path} failed with {response.status_code}: {response.text}")
    return response.json()


def _post(client: TestClient, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = client.post(path, json=payload)
    if response.status_code >= 400:
        raise SmokeFailure(f"POST {path} failed with {response.status_code}: {response.text}")
    return response.json()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def _print_report(report: dict[str, Any], output_format: str) -> None:
    if output_format == "json":
        print(json.dumps(report, indent=2))
        return
    print(f"Local voice smoke: {report['status']}")
    if report.get("data_dir"):
        print(f"Data dir: {report['data_dir']}")
    if report.get("audio_path"):
        print(f"Audio: {report['audio_path']}")
    if report.get("error"):
        print(f"Error: {report['error']}")
    for step in report.get("steps", []):
        print(f"- {step['id']}: {step['status']} - {step['detail']}")


if __name__ == "__main__":
    raise SystemExit(main())
