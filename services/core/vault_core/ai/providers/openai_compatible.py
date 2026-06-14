from __future__ import annotations

from vault_core.ai.providers.mock import MockLLMProvider


class OpenAICompatibleProvider(MockLLMProvider):
    """Optional remote provider, disabled by default in alpha settings."""

