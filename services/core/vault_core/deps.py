from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request

from vault_core.db.session import VaultDatabase


def get_db(request: Request) -> VaultDatabase:
    return request.app.state.db


def require_auth(
    request: Request,
    authorization: str | None = Header(default=None),
) -> None:
    token: str | None = request.app.state.settings.desktop_token
    if not token:
        return
    if authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Invalid desktop token")


Auth = Depends(require_auth)

