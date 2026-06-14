# V1 Alpha Architecture

The desktop renderer never receives filesystem access or a backend token. Electron main starts the Python core, owns the token, validates IPC routes, and proxies requests to `127.0.0.1`.

The core uses SQLite in WAL mode and stores canonical knowledge only through review-gated APIs. Generated extraction output becomes `review_items`; approval creates graph nodes, claims, and evidence links in one transaction.

Tool Studio Lite runs tools in temporary directories with JSON input/output, timeouts, captured logs, and no database credentials.

## Editor And Quick Capture

The Notes editor is built on TipTap/ProseMirror, not a homegrown rich-text surface. Quick notes intentionally stay lightweight: the global shortcut opens a plain capture modal, saves into Notes as `capture_mode: quick_note`, and stores a TipTap-shaped `editor_doc` so the full editor can pick it up immediately. Storage remains reserved for imported evidence, transcripts, and source files.

## V0.2 Planning Update

The v0.2 briefing adds a major missing subsystem: downloadable local AI models and voice workflows. The current v1 code now has capability routing, mock-safe defaults, model-pack metadata, registry/download plumbing, runtime health, a first-run Local AI Setup Wizard, local llama.cpp execution paths for tested GGUF imports, local embedding/search foundations, local voice dictation plumbing, and cached playable local TTS speech assets through mock or configured Piper routes.

The important distinction: the app has a fixture/demo local model pack, a demo managed runtime, safe plumbing for registry-defined downloads, a setup wizard that can rehearse the install/test/select flow, and a production readiness report that aggregates model-pack, runtime, privacy, and capability-route blockers. `./scripts/check_ai_readiness.sh` now uses that same readiness contract as a strict release gate, with `--allow-demo` only for development builds that intentionally allow fixture assets and Markdown export available for auditable local-model approval checklists. It does not yet have release-approved production small model packs. The roadmap now tracks that explicitly as Milestone 4F, followed by production managed local runtime installation in 4G and production first-run setup/repair in 4H. Approved production model packs and bundled runtime installation are still pending; tests intentionally continue to use mocks and fixtures.

The roadmap now treats Local AI Runtime as its own layer owned by Vault Core:

```text
Electron = cockpit
Vault Core = research operating system
Local AI runtime = private engine room
Python Tool Studio = lab bench
Voice layer = microphone and narrator
```

The next architectural slice is documented in `docs/architecture/local-ai-voice-roadmap.md`.
