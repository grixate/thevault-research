# Vault Core

FastAPI service launched by Electron main. It stores state in SQLite, writes an event log for mutations, and treats AI/tool output as untrusted proposals until review approval.

```bash
uv sync
uv run python -m vault_core.main --dev
uv run pytest
```

Environment variables:

- `VAULT_DATA_DIR`: data directory. Defaults to `~/Library/Application Support/The Vault Research Lab`.
- `VAULT_DESKTOP_TOKEN`: optional bearer token required for API calls.
- `VAULT_CORE_PORT`: fixed port. If omitted, the server uses `8765`.

