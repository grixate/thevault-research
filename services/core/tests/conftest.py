from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from vault_core.app import create_app
from vault_core.config import Settings


@pytest.fixture()
def client(tmp_path) -> Iterator[TestClient]:
    settings = Settings(data_dir=tmp_path, desktop_token=None, port=8877, workspace_name="Test Lab")
    app = create_app(settings)
    with TestClient(app) as test_client:
        yield test_client
