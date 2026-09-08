from app.services.llm import call_llm_json

SYSTEM_PROMPT = (
    "You are a contract/document analyst. Given the full extracted text of a "
    "document, produce a concise summary and extract key clauses with risk "
    "levels. Respond with a JSON object with exactly these keys: "
    '"summary_text" (string, 3-6 sentences), '
    '"key_clauses" (array of objects, each with "clause_type" (e.g. '
    '"termination", "liability", "payment", "confidentiality", "indemnification"), '
    '"text" (the relevant excerpt), and "risk_level" ("low"|"medium"|"high")).'
)

MAX_CHARS = 12000  # keep prompt bounded for very long documents


def summarize_document(full_text: str) -> dict:
    truncated = full_text[:MAX_CHARS]
    result = call_llm_json(SYSTEM_PROMPT, f"Document text:\n{truncated}")
    parsed = result.json()
    return {
        "summary_text": str(parsed.get("summary_text", "")),
        "key_clauses": parsed.get("key_clauses", []) or [],
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }
