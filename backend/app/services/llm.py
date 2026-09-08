"""Thin Groq wrapper. All LLM-dependent features go through here so there is
one place that enforces "no GROQ_API_KEY -> clear error, never a crash or a
faked result" (per SPEC.md's Demo Mode section)."""

import json
import logging

from groq import Groq

from app.config import get_settings

logger = logging.getLogger("inteldocs.llm")


class LLMUnavailableError(RuntimeError):
    """Raised when a Groq-backed feature is called without a configured API key."""


class LLMCallResult:
    def __init__(self, content: str, prompt_tokens: int, completion_tokens: int, model: str):
        self.content = content
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.model = model

    def json(self) -> dict:
        try:
            return json.loads(self.content)
        except json.JSONDecodeError:
            logger.warning("LLM response was not valid JSON, attempting salvage")
            # Best-effort salvage: find the first {...} block.
            start = self.content.find("{")
            end = self.content.rfind("}")
            if start != -1 and end != -1 and end > start:
                return json.loads(self.content[start : end + 1])
            raise


_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    settings = get_settings()
    if not settings.groq_enabled:
        raise LLMUnavailableError(
            "AI features unavailable: GROQ_API_KEY is not configured. "
            "Embeddings, reranking, and OCR still work locally with no API key."
        )
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def call_llm_json(system_prompt: str, user_prompt: str, temperature: float = 0.2) -> LLMCallResult:
    """Calls Groq requesting a JSON object response. Raises LLMUnavailableError
    if no API key is configured -- callers must surface this as a clear error,
    not a fake/hardcoded answer."""
    settings = get_settings()
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.groq_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=temperature,
        response_format={"type": "json_object"},
    )
    choice = response.choices[0]
    usage = response.usage
    return LLMCallResult(
        content=choice.message.content or "{}",
        prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
        completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
        model=settings.groq_model,
    )
