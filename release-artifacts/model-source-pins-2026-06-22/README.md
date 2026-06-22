# Model source pins evidence - 2026-06-22

This directory stores durable evidence from the production local-AI model source
pinning slice.

- `source-probe.json`: source/license probe after Hugging Face hydration and
  Piper sidecar byte evidence application.
- `piper-sidecar-byte-verification.txt`: byte-verification summary for the
  Piper ONNX model plus JSON sidecar.
- `piper-sidecar-byte-evidence.json`: overlay evidence that fills the Piper
  JSON sidecar SHA-256.
- `merged-byte-evidence.json`: merged overlay for the published Whisper runtime
  package and Piper sidecar byte evidence.
- `release-packet.md`: regenerated release packet index.
- `release-packet-summary.json`: machine-readable release packet summary.

Current result:

- Source probe: 55 checks pass, 0 warn, 0 pending, 0 blocked.
- Structural validation: pass with 13 approval-status warnings.
- Release packet: blocked, with 0 blocking source-probe findings.
- Remaining gate: reviewer approval evidence, setup/smoke verification, dry-run
  pinning, final pinning, and capability-route activation.

The generated candidate registries remain temporary release-review inputs. This
evidence does not approve or pin production local-AI manifests by itself.
