from __future__ import annotations

import argparse
import json
import sys
import tempfile
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
    data_dir_arg = args.data_dir
    if args.profile == "production" and data_dir_arg is None:
        data_dir_arg = load_settings().data_dir
    try:
        with _data_dir_context(data_dir_arg, args.keep_data_dir) as data_dir:
            report = run_local_ai_smoke(data_dir, args)
    except SmokeFailure as exc:
        report = {
            "status": "fail",
            "error": str(exc),
            "profile": args.profile,
            "data_dir": str(data_dir_arg.expanduser()) if data_dir_arg else None,
        }
        _print_report(report, args.format)
        return 1
    except Exception as exc:
        print(f"Local AI smoke failed unexpectedly: {exc}", file=sys.stderr)
        return 2

    _print_report(report, args.format)
    return 0 if report["status"] == "pass" else 1


def run_local_ai_smoke(data_dir: Path, args: argparse.Namespace) -> dict[str, Any]:
    settings = _settings_for_data_dir(data_dir)
    steps: list[dict[str, Any]] = []
    prompt = args.prompt.strip() or "Summarize this local AI smoke check."
    with TestClient(create_app(settings)) as client:
        health = _get(client, "/health")
        _require(health.get("ok") is True, "Core health check failed.")
        steps.append({"id": "health", "status": "pass", "detail": f"Core {health.get('version')} online."})

        validation = _get(client, "/ai/registry/validation")
        _require(validation.get("status") == "pass", "AI registry structural validation failed.")
        steps.append(
            {
                "id": "registry",
                "status": "pass",
                "detail": (
                    f"{validation['summary']['model_count']} models / "
                    f"{validation['summary']['model_pack_count']} packs / "
                    f"{validation['summary']['runtime_count']} runtimes, "
                    f"{validation['summary']['warning_count']} warnings."
                ),
            }
        )

        if args.profile == "demo":
            setup = _post(client, "/ai/setup/run", {"mode": "demo", "timeout_seconds": args.timeout_seconds})
            _require(setup.get("status") not in {"blocked", "failed"}, f"Demo setup failed: {setup.get('status')}")
            steps.append(
                {
                    "id": "setup",
                    "status": "pass",
                    "detail": f"Demo setup returned {setup.get('status')} with {len(setup.get('steps', []))} steps.",
                }
            )
        else:
            route_detail = _require_production_routes(client)
            steps.append({"id": "production_routes", "status": "pass", "detail": route_detail})

        generated = _post(
            client,
            "/ai/generate/text",
            {
                "capability": "summarize",
                "prompt": prompt,
                "local_only": True,
                "max_tokens": 128,
            },
        )
        _require(generated.get("sent_off_device") is False, "Text generation left the device.")
        _require(bool(str(generated.get("text") or "").strip()), "Text generation returned no text.")
        if args.profile == "production":
            _require(generated.get("provider") in {"llama_cpp_cli", "llama_cpp_server"}, "Production text route is not using llama.cpp.")
            _require(not str(generated.get("model_id") or "").startswith("mock-"), "Production text route is using a mock model.")
            _require(_looks_like_clean_text(str(generated.get("text") or "")), "Production text route returned llama.cpp wrapper output.")
        steps.append(
            {
                "id": "generate_text",
                "status": "pass",
                "detail": f"{generated.get('provider')} / {generated.get('model_id')}",
            }
        )

        generated_json = _post(
            client,
            "/ai/generate/json",
            {
                "capability": "extract_objects",
                "prompt": "Return no canonical objects for this smoke check.",
                "schema_name": "VaultObjectExtraction",
                "local_only": True,
            },
        )
        _require(generated_json.get("sent_off_device") is False, "JSON generation left the device.")
        _require(isinstance(generated_json.get("data"), dict), "JSON generation returned malformed data.")
        steps.append({"id": "generate_json", "status": "pass", "detail": "Structured local route responded."})

        embedded = _post(
            client,
            "/ai/embed",
            {"texts": ["local ai smoke", "private research lab"], "capability": "embed_text", "local_only": True},
        )
        vectors = embedded.get("vectors")
        _require(embedded.get("sent_off_device") is False, "Embedding route left the device.")
        _require(isinstance(vectors, list) and len(vectors) == 2, "Embedding route returned malformed vectors.")
        steps.append(
            {
                "id": "embed_text",
                "status": "pass",
                "detail": f"{embedded.get('dimensions')} dimensions across {len(vectors)} vectors.",
            }
        )

        reranked = _post(
            client,
            "/ai/rerank",
            {
                "query": "local private",
                "candidates": [
                    {"id": "a", "text": "local private research model"},
                    {"id": "b", "text": "remote public service"},
                ],
                "capability": "rerank_results",
                "local_only": True,
            },
        )
        _require(reranked.get("sent_off_device") is False, "Rerank route left the device.")
        _require(len(reranked.get("results") or []) == 2, "Rerank route returned malformed results.")
        steps.append({"id": "rerank_results", "status": "pass", "detail": "Local reranker returned two candidates."})

        runs = _get(client, "/ai/runs")
        runs_text = json.dumps(runs)
        _require(prompt not in runs_text, "AI run log leaked the full private prompt.")
        steps.append({"id": "run_log", "status": "pass", "detail": f"{len(runs)} AI runs without full prompt text."})

        readiness = _get(client, "/ai/readiness/report")
        if (args.strict_production or args.profile == "production") and not readiness.get("production_ready"):
            raise SmokeFailure("Strict production mode requested, but local AI production readiness is blocked.")
        steps.append(
            {
                "id": "readiness",
                "status": "pass" if readiness.get("production_ready") else "warn",
                "detail": (
                    f"{readiness.get('status')} with "
                    f"{readiness['summary']['blocked_count']} blocked production checks."
                ),
            }
        )

    return {
        "status": "pass",
        "profile": args.profile,
        "data_dir": str(data_dir),
        "strict_production": bool(args.strict_production),
        "steps": steps,
    }


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run an in-process local AI smoke check against Vault Core.")
    parser.add_argument(
        "--profile",
        choices=["demo", "production"],
        default="demo",
        help=(
            "Smoke profile. demo installs/uses fixture routes in an isolated data directory; "
            "production uses existing activated routes and fails unless production readiness is clear."
        ),
    )
    parser.add_argument("--data-dir", type=Path, help="Vault data directory to use. Defaults to a temporary directory.")
    parser.add_argument("--keep-data-dir", action="store_true", help="Keep the temporary data directory after the smoke check.")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format.")
    parser.add_argument("--strict-production", action="store_true", help="Fail unless the production local-AI gate is ready.")
    parser.add_argument("--timeout-seconds", type=float, default=10.0, help="Setup-run timeout for smoke steps.")
    parser.add_argument("--prompt", default="Summarize this local AI smoke check.", help="Prompt used for local text generation.")
    return parser.parse_args(argv)


PRODUCTION_LLM_CAPABILITIES = {
    "extract_objects",
    "extract_claims",
    "summarize",
    "generate_note",
    "grounded_answer",
    "create_learning_item",
}
PRODUCTION_REQUIRED_PROVIDERS = {
    **{capability: {"llama_cpp_cli", "llama_cpp_server"} for capability in PRODUCTION_LLM_CAPABILITIES},
    "embed_text": {"local_embedding", "llama_cpp_server_embeddings"},
    "transcribe_audio": {"whisper_cpp"},
    "synthesize_speech": {"piper"},
}


def _require_production_routes(client: TestClient) -> str:
    capabilities = _get(client, "/ai/capabilities")
    _require(isinstance(capabilities, list), "Capability route returned malformed data.")
    bindings = {str(item.get("capability")): item for item in capabilities if isinstance(item, dict)}
    missing = sorted(set(PRODUCTION_REQUIRED_PROVIDERS) - set(bindings))
    _require(not missing, f"Production routes are missing capabilities: {', '.join(missing)}.")
    inactive: list[str] = []
    for capability, allowed_providers in PRODUCTION_REQUIRED_PROVIDERS.items():
        binding = bindings[capability]
        provider_id = str(binding.get("provider_id") or "")
        model_id = str(binding.get("model_id") or "")
        local_only = bool(binding.get("local_only"))
        if provider_id not in allowed_providers or provider_id.startswith("mock_") or model_id.startswith("mock-") or not local_only:
            inactive.append(f"{capability} -> {provider_id or '<none>'}/{model_id or '<none>'}")
    _require(not inactive, "Production routes are not active: " + "; ".join(inactive) + ".")
    return f"{len(PRODUCTION_REQUIRED_PROVIDERS)} required production routes active."


def _looks_like_clean_text(text: str) -> bool:
    blocked_fragments = [
        "build:",
        "system_info:",
        "sampler seed:",
        "llama_perf_context",
        "[ prompt:",
        "available commands:",
        "exiting.",
    ]
    lowered = text.lower()
    return all(fragment not in lowered for fragment in blocked_fragments)


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
        resolved = Path(tempfile.mkdtemp(prefix="vault-local-ai-smoke-"))
        yield resolved
        return
    with tempfile.TemporaryDirectory(prefix="vault-local-ai-smoke-") as temp_dir:
        yield Path(temp_dir)


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
    print(f"Local AI smoke: {report['status']}")
    if report.get("profile"):
        print(f"Profile: {report['profile']}")
    if report.get("data_dir"):
        print(f"Data dir: {report['data_dir']}")
    if report.get("strict_production"):
        print("Gate mode: strict production")
    if report.get("error"):
        print(f"Error: {report['error']}")
    for step in report.get("steps", []):
        print(f"- {step['id']}: {step['status']} - {step['detail']}")


if __name__ == "__main__":
    raise SystemExit(main())
