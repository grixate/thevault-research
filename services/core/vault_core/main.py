from __future__ import annotations

import argparse
import secrets

import uvicorn

from vault_core.app import create_app
from vault_core.config import load_settings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dev", action="store_true")
    parser.add_argument("--port", type=int, default=None)
    args = parser.parse_args()
    settings = load_settings()
    if args.port:
        settings = type(settings)(
            data_dir=settings.data_dir,
            desktop_token=settings.desktop_token or (None if args.dev else secrets.token_urlsafe(24)),
            host=settings.host,
            port=args.port,
            workspace_name=settings.workspace_name,
        )
    app = create_app(settings)
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()

