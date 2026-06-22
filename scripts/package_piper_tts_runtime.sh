#!/usr/bin/env bash
set -euo pipefail

VERSION="1.4.2"
OUTPUT_DIR="/tmp/vault-piper-package/dist"
WORK_DIR="/tmp/vault-piper-package"
PYTHON_BIN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    --work-dir)
      WORK_DIR="$2"
      shift 2
      ;;
    --python)
      PYTHON_BIN="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: ./scripts/package_piper_tts_runtime.sh [options]

Builds a macOS arm64 Piper TTS runtime package from the piper-tts PyPI wheel
with vendored Python dependencies.

Options:
  --version VERSION     piper-tts version to package (default: 1.4.2)
  --output-dir DIR      package output directory (default: /tmp/vault-piper-package/dist)
  --work-dir DIR        build workspace (default: /tmp/vault-piper-package)
  --python PATH         Python interpreter used to resolve compatible wheels
USAGE
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" || "$(uname -m)" != "arm64" ]]; then
  echo "This package target must be built on macOS arm64." >&2
  exit 1
fi

if [[ -z "$PYTHON_BIN" ]]; then
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [[ -x "$ROOT_DIR/services/core/.venv/bin/python" ]]; then
    PYTHON_BIN="$ROOT_DIR/services/core/.venv/bin/python"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    echo "python3 is required." >&2
    exit 1
  fi
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required to resolve the vendored Piper dependencies." >&2
  exit 1
fi

PACKAGE_ROOT="piper-tts-${VERSION}-macos-arm64"
ARCHIVE_NAME="${PACKAGE_ROOT}.tar.gz"
PACKAGE_DIR="${WORK_DIR}/package"
RUNTIME_DIR="${PACKAGE_DIR}/${PACKAGE_ROOT}"
DIST_DIR="${OUTPUT_DIR}"
PACKAGE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"
METADATA_PATH="${DIST_DIR}/${PACKAGE_ROOT}.metadata.json"
TAR_PATH="${DIST_DIR}/${PACKAGE_ROOT}.tar"

rm -rf "$PACKAGE_DIR"
mkdir -p "$RUNTIME_DIR/site" "$DIST_DIR"

uv pip install \
  --python "$PYTHON_BIN" \
  --target "$RUNTIME_DIR/site" \
  "piper-tts==${VERSION}" \
  "onnxruntime==1.27.0" \
  "numpy==2.5.0" \
  "pathvalidate==3.3.1" \
  "flatbuffers==25.12.19" \
  "packaging==26.2" \
  "protobuf==7.35.1"

cat > "$RUNTIME_DIR/piper" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PYTHON_BIN="${VAULT_PIPER_PYTHON:-python3}"
export PYTHONPATH="$DIR/site${PYTHONPATH:+:$PYTHONPATH}"
exec "$PYTHON_BIN" -m piper "$@"
WRAPPER
chmod 755 "$RUNTIME_DIR/piper"

SMOKE_OUTPUT="$(VAULT_PIPER_PYTHON="$PYTHON_BIN" "$RUNTIME_DIR/piper" --help 2>&1 | sed -n '/[^[:space:]]/p' | head -n 1)"

find "$RUNTIME_DIR" -name "__pycache__" -type d -prune -exec rm -rf {} +
find "$RUNTIME_DIR" \( -name "*.pyc" -o -name "*.pyo" -o -name ".lock" \) -type f -delete
find "$RUNTIME_DIR" -exec touch -t 202606220000 {} +

rm -f "$PACKAGE_PATH" "$TAR_PATH" "${TAR_PATH}.gz"
COPYFILE_DISABLE=1 tar -cf "$TAR_PATH" -C "$PACKAGE_DIR" "$PACKAGE_ROOT"
gzip -n "$TAR_PATH"
mv "${TAR_PATH}.gz" "$PACKAGE_PATH"

SHA256="$(shasum -a 256 "$PACKAGE_PATH" | awk '{print $1}')"
SIZE_BYTES="$(wc -c < "$PACKAGE_PATH" | tr -d ' ')"
WRAPPER_SHA256="$(shasum -a 256 "$RUNTIME_DIR/piper" | awk '{print $1}')"
WRAPPER_SIZE_BYTES="$(wc -c < "$RUNTIME_DIR/piper" | tr -d ' ')"

"$PYTHON_BIN" - "$METADATA_PATH" <<PY
import json
import platform
import sys
from pathlib import Path

metadata_path = Path(sys.argv[1])
payload = {
    "runtime_id": "piper-managed-runtime",
    "shortlist_id": "piper-tts-macos-arm64",
    "source_package": "piper-tts",
    "source_version": "$VERSION",
    "source_url": "https://pypi.org/project/piper-tts/$VERSION/",
    "package_filename": "$ARCHIVE_NAME",
    "package_path": "$PACKAGE_PATH",
    "archive_format": "tar.gz",
    "archive_member": "$PACKAGE_ROOT/piper",
    "sha256": "$SHA256",
    "size_bytes": int("$SIZE_BYTES"),
    "wrapper_sha256": "$WRAPPER_SHA256",
    "wrapper_size_bytes": int("$WRAPPER_SIZE_BYTES"),
    "license_label": "GPL-3.0-or-later",
    "license_url": "https://github.com/OHF-Voice/piper1-gpl/blob/main/COPYING",
    "build": {
        "system": platform.system(),
        "machine": platform.machine(),
        "python": "$PYTHON_BIN",
        "vendored_dependencies": [
            "piper-tts==$VERSION",
            "onnxruntime==1.27.0",
            "numpy==2.5.0",
            "pathvalidate==3.3.1",
            "flatbuffers==25.12.19",
            "packaging==26.2",
            "protobuf==7.35.1",
        ],
    },
    "smoke_test": {
        "args": ["--help"],
        "allowed_exit_codes": [0],
        "first_line": "$SMOKE_OUTPUT",
    },
}
metadata_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY

echo "Wrote $PACKAGE_PATH"
echo "Wrote $METADATA_PATH"
echo "SHA-256: $SHA256"
echo "Size bytes: $SIZE_BYTES"
