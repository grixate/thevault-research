from __future__ import annotations

import re
from typing import Any

ALLOWED_OBJECT_TYPES = {
    "claim",
    "concept",
    "question",
    "definition",
    "procedure",
    "task",
    "project",
    "person",
    "organization",
    "tool_idea",
    "contradiction",
    "learning_goal",
}

ALLOWED_RELATIONS = {
    "derived_from",
    "cites",
    "supports",
    "contradicts",
    "mentions",
    "explains",
    "depends_on",
    "part_of",
    "example_of",
    "duplicates",
    "outdated_by",
    "refines",
    "prerequisite_for",
    "useful_for",
    "generates",
    "validates",
    "invalidates",
}

PRIVILEGED_STATUSES = {"verified", "user_confirmed"}


def sentence_candidates(text: str, limit: int = 3) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    candidates = []
    for sentence in sentences:
        clean = " ".join(sentence.split())
        if 40 <= len(clean) <= 360 and not clean.startswith("Ignore all previous"):
            candidates.append(clean)
        if len(candidates) >= limit:
            break
    return candidates


def deterministic_extract(block: dict[str, Any], kinds: list[str]) -> list[dict[str, Any]]:
    text = block["text"]
    block_id = block["id"]
    objects: list[dict[str, Any]] = []
    if "claims" in kinds:
        for sentence in sentence_candidates(text):
            objects.append(
                {
                    "type": "claim",
                    "title": sentence[:90].rstrip(". "),
                    "body": sentence,
                    "source_block_id": block_id,
                    "source_quote": sentence,
                    "confidence": 0.72,
                    "language": "en",
                    "tags": ["mock_extraction"],
                    "relations": [],
                }
            )
    if "concepts" in kinds:
        concepts = sorted(set(re.findall(r"\b[A-Z][A-Za-z][A-Za-z -]{2,40}\b", text)))[:2]
        for concept in concepts:
            objects.append(
                {
                    "type": "concept",
                    "title": concept.strip(),
                    "body": f"Concept mentioned in source block: {concept.strip()}",
                    "source_block_id": block_id,
                    "source_quote": concept.strip(),
                    "confidence": 0.58,
                    "language": "en",
                    "tags": ["mock_extraction"],
                    "relations": [],
                }
            )
    return objects


def validate_extracted_object(obj: dict[str, Any], block_text: str) -> tuple[bool, str | None]:
    if obj.get("type") not in ALLOWED_OBJECT_TYPES:
        return False, "Unsupported object type"
    if obj.get("status") in PRIVILEGED_STATUSES:
        return False, "Model attempted to set privileged status"
    title = str(obj.get("title", "")).strip()
    body = str(obj.get("body", "")).strip()
    quote = str(obj.get("source_quote", "")).strip()
    if not title or len(title) > 180:
        return False, "Title is empty or too long"
    if not body or len(body) > 1200:
        return False, "Body is empty or too long"
    confidence = obj.get("confidence", 0)
    if not isinstance(confidence, int | float) or not 0 <= float(confidence) <= 1:
        return False, "Confidence must be between 0 and 1"
    if obj.get("type") in {"claim", "definition", "procedure", "contradiction"}:
        if not quote or quote not in block_text:
            return False, "Source quote is not an exact substring of source block"
    relations = obj.get("relations", []) or []
    if not isinstance(relations, list):
        return False, "Relations must be an array"
    for relation in relations:
        if not isinstance(relation, dict):
            return False, "Relation must be an object"
        if relation.get("type") not in ALLOWED_RELATIONS:
            return False, "Unsupported relation type"
        target_ref = str(relation.get("target_ref", "")).strip()
        if not target_ref or len(target_ref) > 180:
            return False, "Relation target_ref is empty or too long"
        relation_confidence = relation.get("confidence", 0)
        if not isinstance(relation_confidence, int | float) or not 0 <= float(relation_confidence) <= 1:
            return False, "Relation confidence must be between 0 and 1"
    suspicious = re.compile(r"(import os|subprocess|rm -rf|open\(|exec\(|eval\()", re.I)
    relation_text = " ".join(
        f"{relation.get('type', '')} {relation.get('target_ref', '')}" for relation in relations if isinstance(relation, dict)
    )
    if suspicious.search(f"{title} {body} {relation_text}"):
        return False, "Executable content is not allowed in extracted object fields"
    return True, None
