from __future__ import annotations

from pathlib import Path


def model_storage_root(data_dir: Path) -> Path:
    return data_dir / "models"

