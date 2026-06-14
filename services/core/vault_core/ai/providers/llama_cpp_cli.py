from __future__ import annotations

from vault_core.ai.providers.mock import MockLLMProvider


class LlamaCppCliProvider(MockLLMProvider):
    """Placeholder provider interface for local structured extraction.

    The v1 product keeps this pluggable while the deterministic extractor powers tests and
    offline use. Real llama.cpp execution can be wired here without changing API handlers.
    """

