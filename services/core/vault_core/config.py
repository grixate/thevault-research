from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    desktop_token: str | None
    host: str = "127.0.0.1"
    port: int = 8765
    workspace_name: str = "Research Lab"
    llama_cpp_cli_path: str | None = None
    llama_cpp_server_path: str | None = None
    whisper_cpp_cli_path: str | None = None
    whisper_cpp_model_path: str | None = None

    @property
    def db_path(self) -> Path:
        return self.data_dir / "vault.db"

    @property
    def blob_dir(self) -> Path:
        return self.data_dir / "blobs"

    @property
    def tool_dir(self) -> Path:
        return self.data_dir / "tools"


def load_settings() -> Settings:
    default_data = Path.home() / "Library" / "Application Support" / "The Vault Research Lab"
    data_dir = Path(os.environ.get("VAULT_DATA_DIR", default_data)).expanduser()
    return Settings(
        data_dir=data_dir,
        desktop_token=os.environ.get("VAULT_DESKTOP_TOKEN"),
        port=int(os.environ.get("VAULT_CORE_PORT", "8765")),
        workspace_name=os.environ.get("VAULT_WORKSPACE_NAME", "Research Lab"),
        llama_cpp_cli_path=os.environ.get("VAULT_LLAMA_CPP_CLI"),
        llama_cpp_server_path=os.environ.get("VAULT_LLAMA_CPP_SERVER"),
        whisper_cpp_cli_path=os.environ.get("VAULT_WHISPER_CPP_CLI"),
        whisper_cpp_model_path=os.environ.get("VAULT_WHISPER_CPP_MODEL"),
    )
