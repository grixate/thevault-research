# Candidate AI Registry Release Packet

- Status: **ready_to_pin**
- Source probe: **pass**
- Byte verification: **not_run**
- Applied evidence fields: **16**
- Patched model registry SHA-256: `5419d56e760155d9559e0479b453cfad90e304be4395fa610fd0df4dbee20e08`
- Patched runtime registry SHA-256: `a050ca271ca3acee8fa2df7875ab91327571f462bdc766e1889dffd96f92d2a6`

## Artifacts

- `candidate-ai-registry-evidence-bundle.json` - evidence_bundle
- `vault-candidate-model-registry.hydrated.patched.patched.json` - patched_model_registry
- `vault-candidate-runtime-registry.model-source-pins.patched.patched.json` - patched_runtime_registry
- `candidate-ai-registry-release-plan.applied.md` - applied_release_plan
- `candidate-local-ai-approval-template.applied.md` - applied_approval_checklist
- `candidate-ai-registry-pin-handoff.applied.md` - pin_handoff
- `candidate-ai-registry-artifact-probe.applied.md` - artifact_probe
- `candidate-ai-registry-acceptance.applied.md` - acceptance_report

## Commands

```sh
./scripts/probe_ai_registry_artifacts.sh --model-registry vault-candidate-model-registry.hydrated.patched.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.patched.json --format markdown --output candidate-ai-registry-artifact-probe.applied.md
./scripts/verify_ai_registry_artifacts.sh --model-registry vault-candidate-model-registry.hydrated.patched.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.patched.json --format markdown --output candidate-ai-registry-artifact-byte-verification.applied.md --evidence-output candidate-ai-byte-evidence.applied.json
./scripts/pin_ai_registries.sh --check --model-registry vault-candidate-model-registry.hydrated.patched.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.patched.json --format markdown --output candidate-ai-registry-acceptance.applied.md
./scripts/pin_ai_registries.sh --check --model-registry vault-candidate-model-registry.hydrated.patched.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.patched.json --format json
./scripts/pin_ai_registries.sh --model-registry vault-candidate-model-registry.hydrated.patched.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.patched.json
./scripts/check_ai_readiness.sh --format text
```

## Next Actions

- [x] Packet artifacts are ready for release review and guarded pinning.
