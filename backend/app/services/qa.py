"""Cited Q&A: retrieve -> rerank -> Groq answer with structured citations,
validated against the chunks actually provided as context."""

import time
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.services.llm import call_llm_json
from app.services.retrieval import RetrievedChunk, retrieve

SYSTEM_PROMPT = (
    "You are a document Q&A assistant. You will be given a question and a set of "
    "numbered context chunks extracted from documents. Answer ONLY using the "
    "provided chunks. If the chunks do not contain the answer, say so plainly. "
    "Respond with a JSON object with exactly these keys: "
    '"answer" (string), '
    '"citations" (array of objects, each with "chunk_id" (integer, must be one of '
    "the provided chunk ids) and \"snippet\" (a short quote from that chunk "
    'supporting the answer)), '
    '"confidence" (float between 0 and 1, your confidence the answer is correct '
    "and fully supported by the provided chunks). "
    "Every chunk_id you cite MUST be one of the ids given to you below. Never "
    "invent a chunk_id."
)


@dataclass
class AnswerResult:
    answer: str
    citations: list[dict]
    confidence: float
    model_used: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int
    retrieved_chunks: list[RetrievedChunk]


def _build_context(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for c in chunks:
        parts.append(f"[chunk_id={c.chunk_id} page={c.page_number}]\n{c.text}")
    return "\n\n".join(parts)


def answer_question(
    db: Session,
    org_id: int,
    question: str,
    document_ids: list[int] | None,
    retrieval_config: str = "hybrid+rerank",
) -> AnswerResult:
    start = time.monotonic()
    chunks = retrieve(db, org_id, question, document_ids, retrieval_config=retrieval_config)

    if not chunks:
        latency_ms = int((time.monotonic() - start) * 1000)
        return AnswerResult(
            answer="No relevant content was found in the available documents to answer this question.",
            citations=[],
            confidence=0.0,
            model_used="none",
            prompt_tokens=0,
            completion_tokens=0,
            latency_ms=latency_ms,
            retrieved_chunks=[],
        )

    context = _build_context(chunks)
    user_prompt = f"Question: {question}\n\nContext chunks:\n{context}"

    result = call_llm_json(SYSTEM_PROMPT, user_prompt)
    parsed = result.json()

    valid_chunk_ids = {c.chunk_id for c in chunks}
    chunk_by_id = {c.chunk_id: c for c in chunks}

    raw_citations = parsed.get("citations", []) or []
    validated_citations: list[dict] = []
    for cit in raw_citations:
        try:
            cid = int(cit.get("chunk_id"))
        except (TypeError, ValueError):
            continue
        if cid not in valid_chunk_ids:
            # Never trust the LLM blindly: drop citations to chunks that
            # weren't actually provided as context.
            continue
        chunk = chunk_by_id[cid]
        validated_citations.append(
            {
                "chunk_id": cid,
                "document_id": chunk.document_id,
                "page_number": chunk.page_number,
                "snippet": str(cit.get("snippet", ""))[:500],
            }
        )

    latency_ms = int((time.monotonic() - start) * 1000)
    return AnswerResult(
        answer=str(parsed.get("answer", "")),
        citations=validated_citations,
        confidence=float(parsed.get("confidence", 0.0) or 0.0),
        model_used=result.model,
        prompt_tokens=result.prompt_tokens,
        completion_tokens=result.completion_tokens,
        latency_ms=latency_ms,
        retrieved_chunks=chunks,
    )
