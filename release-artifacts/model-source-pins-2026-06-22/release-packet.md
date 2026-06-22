# Candidate AI Registry Release Packet

- Status: **blocked**
- Source probe: **warn**
- Byte verification: **not_run**
- Applied evidence fields: **9**
- Patched model registry SHA-256: `a804df817c86b16e2f133753c83b7d60c1d22bb1b0ae31c35376be1f369ab13c`
- Patched runtime registry SHA-256: `09ad85bd412f1dccb853dfdd2577f6a704d8af50064c3abe0d3ec6f8c2d69a9e`

## Artifacts

- `candidate-ai-registry-evidence-bundle.json` - evidence_bundle
- `vault-candidate-model-registry.hydrated.patched.json` - patched_model_registry
- `vault-candidate-runtime-registry.model-source-pins.patched.json` - patched_runtime_registry
- `candidate-ai-registry-release-plan.applied.md` - applied_release_plan
- `candidate-local-ai-approval-template.applied.md` - applied_approval_checklist
- `candidate-ai-registry-pin-handoff.applied.md` - pin_handoff
- `candidate-ai-registry-artifact-probe.applied.md` - artifact_probe
- `candidate-ai-registry-acceptance.applied.md` - acceptance_report

## Commands

```sh
./scripts/probe_ai_registry_artifacts.sh --model-registry vault-candidate-model-registry.hydrated.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.json --format markdown --output candidate-ai-registry-artifact-probe.applied.md
./scripts/verify_ai_registry_artifacts.sh --model-registry vault-candidate-model-registry.hydrated.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.json --format markdown --output candidate-ai-registry-artifact-byte-verification.applied.md --evidence-output candidate-ai-byte-evidence.applied.json
./scripts/pin_ai_registries.sh --check --model-registry vault-candidate-model-registry.hydrated.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.json --format markdown --output candidate-ai-registry-acceptance.applied.md
./scripts/pin_ai_registries.sh --check --model-registry vault-candidate-model-registry.hydrated.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.json --format json
./scripts/pin_ai_registries.sh --model-registry vault-candidate-model-registry.hydrated.patched.json --runtime-registry vault-candidate-runtime-registry.model-source-pins.patched.json
./scripts/check_ai_readiness.sh --format text
```

## Next Actions

- [ ] Resolve registry warnings before pinning approved production registries.
- [ ] Resolve source, checksum, size, license, runtime, and approval blockers for required models.
- [ ] Resolve source, checksum, size, license, and approval blockers for required runtimes.
- [ ] Set approval.status to approved after artifact, license, and runtime review.
- [ ] Set approval.status to approved after artifact, license, and platform review.
- [ ] Resolve registry placeholder warnings before candidate artifact approval.
