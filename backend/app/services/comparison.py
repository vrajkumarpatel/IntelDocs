from app.services.llm import call_llm_json

SYSTEM_PROMPT = (
    "You compare two or more documents and identify substantive differences. "
    "Respond with a JSON object with exactly these keys: "
    '"comparison_text" (string, overall summary of how the documents differ), '
    '"differences" (array of objects, each with "aspect" (what is being '
    'compared, e.g. "termination notice period"), "doc_a_value" (string), and '
    '"doc_b_value" (string)).'
)

MAX_CHARS_PER_DOC = 6000


def compare_documents(labeled_texts: list[tuple[str, str]]) -> dict:
    """labeled_texts: list of (label, full_text), e.g. [("Document 12", "..."), ...]"""
    parts = []
    for label, text in labeled_texts:
        parts.append(f"--- {label} ---\n{text[:MAX_CHARS_PER_DOC]}")
    user_prompt = "\n\n".join(parts)
    result = call_llm_json(SYSTEM_PROMPT, user_prompt)
    parsed = result.json()
    return {
        "comparison_text": str(parsed.get("comparison_text", "")),
        "differences": parsed.get("differences", []) or [],
        "prompt_tokens": result.prompt_tokens,
        "completion_tokens": result.completion_tokens,
    }
