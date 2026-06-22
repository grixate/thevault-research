# Piper TTS Runtime Package

This directory contains the self-contained macOS arm64 Piper runtime package used
by `piper-managed-runtime`.

- Package: `piper-tts-1.4.2-macos-arm64.tar.gz`
- Package SHA-256: `982fd27644cf6fae8657585a81d3a80585b4a4d75f806cabdbc0c3f6f2d6c041`
- Package size: `37760615`
- Archive member: `piper-tts-1.4.2-macos-arm64/piper`
- Build script: `scripts/package_piper_tts_runtime.sh`
- Source package: `piper-tts==1.4.2`
- License: `GPL-3.0-or-later`
- License evidence: `https://github.com/OHF-Voice/piper1-gpl/blob/main/LICENSE`

Why this package exists: the older upstream `piper_macos_aarch64.tar.gz`
archive from `rhasspy/piper` is not self-contained on this host and exits
before smoke testing because `libespeak-ng.1.dylib` is missing. This package
vendors the `piper-tts` wheel and its Python dependencies beside a small
`piper` wrapper, so the managed runtime installer can extract one runtime tree
and smoke it with `--help`.

Build command used:

```sh
./scripts/package_piper_tts_runtime.sh \
  --work-dir /tmp/vault-piper-package-script \
  --output-dir /tmp/vault-piper-package-script/dist
```

Smoke result:

```text
usage: python -m piper [-h] -m MODEL [-c CONFIG] [-i INPUT_FILE]
```
