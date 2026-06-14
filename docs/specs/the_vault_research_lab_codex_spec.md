# The Vault Research Lab Spec

The original v0.1 implementation spec for this repo was provided at:

`/Users/grixate/Downloads/the_vault_research_lab_codex_spec.md`

The current authoritative planning spec is v0.2:

`docs/specs/the_vault_research_lab_codex_spec_v0_2.md`

The v0.2 local AI and voice addendum is also stored separately for focused roadmap work:

`docs/specs/the_vault_research_lab_local_ai_voice_addendum.md`

This repository currently implements a runnable v1 alpha spine plus the first local AI and voice foundations from the v0.2 addendum: capability routing, model registry/download plumbing, llama.cpp discovery and runtime smoke paths, local embedding/search workflows, local STT/TTS routes, durable voice assets, and Settings surfaces.

It still does not ship release-approved production small model packs or managed runtime binaries. The production local-model plan is tracked in `docs/architecture/local-ai-voice-roadmap.md`, especially Milestones 4F-4H.
