from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    data = json.loads(input_path.read_text())
    findings = []
    review_items = []
    for claim in data.get("claims", []):
        evidence = claim.get("evidence", [])
        valid = bool(evidence) and all(link.get("exact_quote", "") in link.get("source_block_text", "") for link in evidence)
        findings.append({"claim_id": claim["id"], "status": "quote_valid" if valid else "quote_invalid"})
    output_path.write_text(json.dumps({"findings": findings, "review_items": review_items, "warnings": []}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

