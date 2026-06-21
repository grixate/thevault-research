# whisper.cpp v1.8.6 macOS arm64 runtime

This directory stores the candidate `whisper-cli` runtime package for the local
voice pipeline.

- Package: `whisper.cpp-v1.8.6-macos-arm64.tar.gz`
- Runtime id: `whisper-cpp-managed-runtime`
- Archive member: `whisper.cpp-v1.8.6-macos-arm64/whisper-cli`
- SHA-256: `cfbba61b4f9a4fa3c0387ff7816c1368cac6394f2c97432e22b635564f03ad6d`
- Size: `1224375`
- Build script: `scripts/package_whisper_cpp_runtime.sh`
- Verification: `prepublish-verification.txt` and `prepublish-verification.json`

The package is built from the upstream `ggml-org/whisper.cpp` `v1.8.6` source
tag because that upstream release does not provide a macOS arm64 `whisper-cli`
runtime archive. This artifact is candidate release evidence only; it does not
by itself approve production local AI runtimes.
