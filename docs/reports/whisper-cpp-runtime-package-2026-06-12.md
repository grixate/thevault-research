# whisper.cpp macOS arm64 Runtime Package

Generated: 2026-06-12  
Purpose: candidate production runtime package for `whisper-cpp-managed-runtime`.

## Package

- Source: `ggml-org/whisper.cpp`
- Source tag: `v1.8.6`
- Build script: `scripts/package_whisper_cpp_runtime.sh`
- Build host: macOS arm64
- Build mode: CMake Release, `WHISPER_BUILD_TESTS=OFF`, `BUILD_SHARED_LIBS=OFF`
- Package path: `/tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.tar.gz`
- Metadata path: `/tmp/vault-whisper-package-script/dist/whisper.cpp-v1.8.6-macos-arm64.metadata.json`
- Archive member: `whisper.cpp-v1.8.6-macos-arm64/whisper-cli`
- Package size: `1224375`
- Package SHA-256: `cfbba61b4f9a4fa3c0387ff7816c1368cac6394f2c97432e22b635564f03ad6d`
- Binary size: `3232440`
- Binary SHA-256: `8c967474d3c6acc16949e20a66abbc5da771bb04212e401ca1d11d3f5b89f3fc`

## Smoke Evidence

- Command: `whisper-cli --help`
- Expected exit codes: `0`
- Result: passed.
- Linkage check: package binary is static with respect to whisper/ggml and only links macOS system libraries/frameworks.

## Pre-Publish Verification

- Verifier: `scripts/verify_whisper_runtime_package.sh`
- Summary report: `/tmp/vault-whisper-runtime-package-prepublish-verification.txt`
- JSON report: `/tmp/vault-whisper-runtime-package-prepublish-verification.json`
- Result: passed, 11/11 checks and 0 blocked.
- Covered checks: package path, filename, size, SHA-256, archive member, executable bit, `--help` smoke command, and metadata filename/SHA-256/size/archive member.

## Registry State

The candidate shortlist now applies `whisper-cpp-macos-arm64` into `whisper-cpp-managed-runtime` with pinned package filename, archive member, size, SHA-256, license URL, and smoke command.

The generated candidate runtime registry is:

`/tmp/vault-candidate-runtime-registry.whisper-packaged.json`

Current candidate release plan with the small-byte-patched model registry and packaged whisper runtime registry:

- Structural validation: pass
- Validation warnings: 14
- Total checks: 142
- Blocked checks: 20
- Production packs ready: 0/3
- Production models ready: 0/10
- Production runtimes ready: 0/3

Source probe result:

- 53 checks
- 52 pass
- 0 blocked
- 1 pending
- Pending item: `whisper-cpp-managed-runtime:files[0]:source`

## Remaining Before Approval

- Publish the package to an approved immutable release URL.
- Replace `REPLACE_WITH_APPROVED_WHISPER_CPP_PACKAGE_URL` in the candidate runtime registry flow.
- Re-run source probe against the published URL.
- Re-run byte verification against the published URL and confirm it matches the pinned SHA-256.
- Run installer/runtime smoke through the app setup path.
- Apply reviewer approval evidence.
