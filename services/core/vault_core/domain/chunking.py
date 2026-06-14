from __future__ import annotations

import hashlib
import re


def content_hash(text: bytes | str) -> str:
    if isinstance(text, str):
        text = text.encode("utf-8")
    return hashlib.sha256(text).hexdigest()


def estimate_tokens(text: str) -> int:
    return max(1, len(re.findall(r"\S+", text)))


def chunk_markdown(text: str, max_words: int = 180) -> list[dict[str, str | int]]:
    blocks: list[dict[str, str | int]] = []
    heading_path: list[str] = []
    current: list[str] = []
    locator_index = 0

    def flush() -> None:
        nonlocal locator_index, current
        merged = "\n".join(part.strip() for part in current if part.strip()).strip()
        current = []
        if not merged:
            return
        words = merged.split()
        for start in range(0, len(words), max_words):
            segment = " ".join(words[start : start + max_words]).strip()
            if not segment:
                continue
            locator_index += 1
            blocks.append(
                {
                    "text": segment,
                    "locator": f"block={locator_index}",
                    "heading_path": " > ".join(heading_path),
                }
            )

    for line in text.splitlines():
        stripped = line.strip()
        heading = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if heading:
            flush()
            level = len(heading.group(1))
            heading_path = heading_path[: level - 1] + [heading.group(2).strip()]
            current.append(stripped)
            continue
        if stripped == "":
            flush()
        else:
            current.append(line)
    flush()
    return blocks

