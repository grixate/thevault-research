# Candidate AI Registry Acceptance

- Status: **ready_to_pin**
- Ready to pin: **yes**
- Dry run: **no**
- Policy written: **yes**

## Gate Summary

| Gate | Value |
| --- | ---: |
| Validation errors | 0 |
| Validation warnings | 0 |
| Blocked artifact checks | 0 |
| Production packs ready | 4/4 |
| Production models ready | 10/10 |
| Production runtimes ready | 3/3 |

## Pin Preview

| Registry | Candidate SHA-256 | Added | Changed | Removed |
| --- | --- | ---: | ---: | ---: |
| `model_registry` | `5419d56e760155d9559e0479b453cfad90e304be4395fa610fd0df4dbee20e08` | 0 | 10 | 0 |
| `runtime_registry` | `a050ca271ca3acee8fa2df7875ab91327571f462bdc766e1889dffd96f92d2a6` | 0 | 3 | 0 |

## Registry Writes

| Registry | Source | Target | SHA-256 |
| --- | --- | --- | --- |
| `model_registry` | `/tmp/vault-approved-release-packet/vault-candidate-model-registry.hydrated.patched.patched.json` | `/Users/grixate/Documents/Research lab/services/core/vault_core/ai/models/model_registry.json` | `5419d56e760155d9559e0479b453cfad90e304be4395fa610fd0df4dbee20e08` |
| `runtime_registry` | `/tmp/vault-approved-release-packet/vault-candidate-runtime-registry.model-source-pins.patched.patched.json` | `/Users/grixate/Documents/Research lab/services/core/vault_core/ai/models/runtime_registry.json` | `a050ca271ca3acee8fa2df7875ab91327571f462bdc766e1889dffd96f92d2a6` |

## Policy

- `model_registry`: `5419d56e760155d9559e0479b453cfad90e304be4395fa610fd0df4dbee20e08` (`model_registry.json`)
- `runtime_registry`: `a050ca271ca3acee8fa2df7875ab91327571f462bdc766e1889dffd96f92d2a6` (`runtime_registry.json`)

## Next Actions

- [x] Candidate manifests are pinned.
