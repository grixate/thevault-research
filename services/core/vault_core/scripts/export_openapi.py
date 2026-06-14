from __future__ import annotations

import json
import sys
from pathlib import Path

from vault_core.app import create_app


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m vault_core.scripts.export_openapi <output-path>")
    output = Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    app = create_app()
    output.write_text(json.dumps(app.openapi(), indent=2))


if __name__ == "__main__":
    main()
