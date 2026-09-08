"""Evaluation pipeline: generate questions from real chunks, run the real
retrieval + answer pipelines against them, and score hit-rate / MRR /
faithfulness for real. Nothing here is hardcoded -- every number comes from
an actual retrieval or LLM call.

The metric math (`compute_hit_and_rank`, `aggregate_metrics`) is pure and
DB-free so it is unit-testable in isolation (see tests/test_eval_metrics.py).
"""

import random
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Chunk
from app.services.llm import call_llm_json
from app.services.qa import answer_question
from app.services.retrieval import retrieve

QUESTION_GEN_SYSTEM_PROMPT = (
    "You write evaluation questions for a document-QA retrieval system. Given "
    "one passage of text, write ONE realistic, specific question that a user "
    "might ask, whose answer is fully contained in the passage. Do not ask "
    'about "this document" in the abstract; ask a concrete question about its '
    "content. Respond with a JSON object: {\"question\": \"...\"}."
)

FAITHFULNESS_SYSTEM_PROMPT = (
    "You are a strict fact-checker judging whether an AI-generated answer is "
    "faithful to the source passages it cites. Faithful = every claim in the "
    "answer is directly supported by the provided passages. Unfaithful = the "
    "answer contradicts the passages or asserts things not present in them. "
    "Partial = some claims are supported and some are not, or the answer is "
    "vague/hedged beyond what the passages justify. Respond with a JSON "
    'object: {"verdict": "faithful"|"unfaithful"|"partial", "reasoning": '
    '"one or two sentence justification"}.'
)


@dataclass
class GeneratedQuestion:
    source_chunk_id: int
    question: str


@dataclass
class RetrievalEvalResult:
    retrieved_chunk_ids: list[int]
    hit: bool
    rank: int | None


def sample_chunks_for_eval(db: Session, document_ids: list[int], num_per_doc: int, seed: int | None = None) -> list[Chunk]:
    """Pick up to num_per_doc chunks per document to generate questions from.
    Uses a fixed-seed random sample for reproducibility if seed is given,
    otherwise a fresh random sample each run (keeps eval runs comparable in
    tests, varied in real usage)."""
    rng = random.Random(seed)
    sampled: list[Chunk] = []
    for doc_id in document_ids:
        chunks = list(db.scalars(select(Chunk).where(Chunk.document_id == doc_id)))
        # Skip near-empty chunks that make poor eval questions.
        chunks = [c for c in chunks if len(c.text.split()) >= 20]
        if not chunks:
            continue
        k = min(num_per_doc, len(chunks))
        sampled.extend(rng.sample(chunks, k))
    return sampled


def generate_question(chunk_text: str) -> str:
    result = call_llm_json(QUESTION_GEN_SYSTEM_PROMPT, f"Passage:\n{chunk_text}")
    parsed = result.json()
    return str(parsed.get("question", "")).strip()


def compute_hit_and_rank(retrieved_chunk_ids: list[int], source_chunk_id: int) -> RetrievalEvalResult:
    """Pure function: was the ground-truth chunk in the retrieved (already
    top-K'd) list, and at what 1-based rank?"""
    try:
        idx = retrieved_chunk_ids.index(source_chunk_id)
        return RetrievalEvalResult(retrieved_chunk_ids=retrieved_chunk_ids, hit=True, rank=idx + 1)
    except ValueError:
        return RetrievalEvalResult(retrieved_chunk_ids=retrieved_chunk_ids, hit=False, rank=None)


def aggregate_metrics(hits: list[bool], ranks: list[int | None]) -> tuple[float, float]:
    """Pure function: hit_rate = fraction of questions where the ground-truth
    chunk was retrieved; MRR = mean of 1/rank across ALL questions (0 for
    misses), the standard Mean Reciprocal Rank definition."""
    if not hits:
        return 0.0, 0.0
    hit_rate = sum(1 for h in hits if h) / len(hits)
    reciprocal_ranks = [(1.0 / r) if (h and r) else 0.0 for h, r in zip(hits, ranks)]
    mrr = sum(reciprocal_ranks) / len(reciprocal_ranks)
    return hit_rate, mrr


_VERDICT_SCORE = {"faithful": 1.0, "partial": 0.5, "unfaithful": 0.0}


def faithfulness_rate(verdicts: list[str]) -> float:
    """Pure function: fraction score where faithful=1.0, partial=0.5,
    unfaithful=0.0, averaged. Documented choice -- SPEC.md defines the field
    as a 0-1 float but doesn't specify how "partial" should weigh in."""
    if not verdicts:
        return 0.0
    return sum(_VERDICT_SCORE.get(v, 0.0) for v in verdicts) / len(verdicts)


def judge_faithfulness(question: str, answer: str, cited_texts: list[str]) -> tuple[str, str]:
    if not cited_texts:
        return "unfaithful", "No citations were provided to support the answer."
    context = "\n\n".join(cited_texts)
    user_prompt = f"Question: {question}\n\nAnswer to judge: {answer}\n\nCited passages:\n{context}"
    result = call_llm_json(FAITHFULNESS_SYSTEM_PROMPT, user_prompt)
    parsed = result.json()
    verdict = str(parsed.get("verdict", "unfaithful")).strip().lower()
    if verdict not in _VERDICT_SCORE:
        verdict = "unfaithful"
    reasoning = str(parsed.get("reasoning", ""))
    return verdict, reasoning


def evaluate_one_question(
    db: Session,
    org_id: int,
    source_chunk_id: int,
    question: str,
    document_ids: list[int],
    retrieval_config: str,
) -> dict:
    """Runs real retrieval + real answer generation + real LLM-judge for one
    generated question. Returns a dict matching EvalQuestion fields."""
    retrieved = retrieve(db, org_id, question, document_ids, retrieval_config=retrieval_config)
    retrieved_ids = [r.chunk_id for r in retrieved]
    eval_result = compute_hit_and_rank(retrieved_ids, source_chunk_id)

    answer_result = answer_question(db, org_id, question, document_ids, retrieval_config=retrieval_config)
    cited_texts = [c.text for c in answer_result.retrieved_chunks if c.chunk_id in {cc["chunk_id"] for cc in answer_result.citations}]
    if not cited_texts:
        cited_texts = [c.text for c in answer_result.retrieved_chunks]
    verdict, reasoning = judge_faithfulness(question, answer_result.answer, cited_texts)

    return {
        "source_chunk_id": source_chunk_id,
        "question": question,
        "retrieved_chunk_ids": retrieved_ids,
        "hit": eval_result.hit,
        "rank": eval_result.rank,
        "generated_answer": answer_result.answer,
        "faithfulness_verdict": verdict,
        "faithfulness_reasoning": reasoning,
        "latency_ms": answer_result.latency_ms,
    }
