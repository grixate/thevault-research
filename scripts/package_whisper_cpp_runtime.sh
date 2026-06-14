#!/usr/bin/env bash
set -euo pipefail

TAG="v1.8.6"
OUTPUT_DIR="/tmp/vault-whisper-package/dist"
WORK_DIR="/tmp/vault-whisper-package"
JOBS="6"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
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
    --jobs)
      JOBS="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'USAGE'
Usage: ./scripts/package_whisper_cpp_runtime.sh [options]

Builds a static macOS arm64 whisper.cpp CLI runtime package from a tagged source release.

Options:
  --tag TAG             whisper.cpp tag to package (default: v1.8.6)
  --output-dir DIR      package output directory (default: /tmp/vault-whisper-package/dist)
  --work-dir DIR        build workspace (default: /tmp/vault-whisper-package)
  --jobs N              parallel build jobs (default: 6)
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

CMAKE_BIN="${CMAKE:-}"
if [[ -z "$CMAKE_BIN" ]]; then
  if command -v cmake >/dev/null 2>&1; then
    CMAKE_BIN="$(command -v cmake)"
  elif [[ -x /opt/homebrew/bin/cmake ]]; then
    CMAKE_BIN="/opt/homebrew/bin/cmake"
  else
    echo "cmake is required. Install it with: brew install cmake" >&2
    exit 1
  fi
fi

TAG_NAME="${TAG#v}"
ARCHIVE_NAME="whisper.cpp-${TAG}-macos-arm64.tar.gz"
PACKAGE_ROOT="whisper.cpp-${TAG}-macos-arm64"
SOURCE_ARCHIVE="${WORK_DIR}/whisper.cpp-${TAG}.tar.gz"
SOURCE_DIR="${WORK_DIR}/whisper.cpp-${TAG_NAME}"
BUILD_DIR="${SOURCE_DIR}/build-static"
PACKAGE_DIR="${WORK_DIR}/package"
DIST_DIR="${OUTPUT_DIR}"
PACKAGE_PATH="${DIST_DIR}/${ARCHIVE_NAME}"
METADATA_PATH="${DIST_DIR}/${ARCHIVE_NAME%.tar.gz}.metadata.json"
TAR_PATH="${DIST_DIR}/${ARCHIVE_NAME%.gz}"
SOURCE_URL="https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${TAG}.tar.gz"

mkdir -p "$WORK_DIR" "$DIST_DIR"

if [[ ! -f "$SOURCE_ARCHIVE" ]]; then
  curl -L "$SOURCE_URL" -o "$SOURCE_ARCHIVE"
fi

rm -rf "$SOURCE_DIR" "$PACKAGE_DIR"
tar -xzf "$SOURCE_ARCHIVE" -C "$WORK_DIR"

"$CMAKE_BIN" \
  -S "$SOURCE_DIR" \
  -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DWHISPER_BUILD_TESTS=OFF \
  -DBUILD_SHARED_LIBS=OFF
"$CMAKE_BIN" --build "$BUILD_DIR" --config Release --target whisper-cli -j "$JOBS"

mkdir -p "${PACKAGE_DIR}/${PACKAGE_ROOT}"
cp "${BUILD_DIR}/bin/whisper-cli" "${PACKAGE_DIR}/${PACKAGE_ROOT}/whisper-cli"
chmod 755 "${PACKAGE_DIR}/${PACKAGE_ROOT}/whisper-cli"
find "${PACKAGE_DIR}/${PACKAGE_ROOT}" -exec touch -t 202606120000 {} +

rm -f "$PACKAGE_PATH" "$TAR_PATH" "${TAR_PATH}.gz"
COPYFILE_DISABLE=1 tar -cf "$TAR_PATH" -C "$PACKAGE_DIR" "$PACKAGE_ROOT"
gzip -n "$TAR_PATH"
mv "${TAR_PATH}.gz" "$PACKAGE_PATH"

SHA256="$(shasum -a 256 "$PACKAGE_PATH" | awk '{print $1}')"
SIZE_BYTES="$(wc -c < "$PACKAGE_PATH" | tr -d ' ')"
BINARY_SHA256="$(shasum -a 256 "${PACKAGE_DIR}/${PACKAGE_ROOT}/whisper-cli" | awk '{print $1}')"
BINARY_SIZE_BYTES="$(wc -c < "${PACKAGE_DIR}/${PACKAGE_ROOT}/whisper-cli" | tr -d ' ')"
SMOKE_OUTPUT="$("${PACKAGE_DIR}/${PACKAGE_ROOT}/whisper-cli" --help 2>&1 | sed -n '/[^[:space:]]/p' | head -n 1)"

python3 - "$METADATA_PATH" <<PY
import json
import platform
import sys
from pathlib import Path

metadata_path = Path(sys.argv[1])
payload = {
    "runtime_id": "whisper-cpp-managed-runtime",
    "shortlist_id": "whisper-cpp-macos-arm64",
    "source_repo": "ggml-org/whisper.cpp",
    "source_tag": "$TAG",
    "source_url": "$SOURCE_URL",
    "package_filename": "$ARCHIVE_NAME",
    "package_path": "$PACKAGE_PATH",
    "archive_format": "tar.gz",
    "archive_member": "$PACKAGE_ROOT/whisper-cli",
    "sha256": "$SHA256",
    "size_bytes": int("$SIZE_BYTES"),
    "binary_sha256": "$BINARY_SHA256",
    "binary_size_bytes": int("$BINARY_SIZE_BYTES"),
    "build": {
        "system": platform.system(),
        "machine": platform.machine(),
        "cmake": "$CMAKE_BIN",
        "cmake_args": [
            "-DCMAKE_BUILD_TYPE=Release",
            "-DWHISPER_BUILD_TESTS=OFF",
            "-DBUILD_SHARED_LIBS=OFF",
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
