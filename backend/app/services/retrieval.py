"""Hybrid retrieval: Postgres full-text search (BM25-style ts_rank) fused with
pgvector cosine similarity via Reciprocal Rank Fusion, optionally narrowed by
a local cross-encoder reranker.

The fusion math (`reciprocal_rank_fusion`) is a pure function with no DB
dependency, so it is unit-testable in isolation (see tests/test_retrieval_fusion.py).
"""

from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.services.embeddings import embed_query
from app.services.reranker import rerank as cross_encoder_rerank

RRF_K = 60

RETRIEVAL_CONFIGS = ("vector_only", "hybrid", "hybrid+rerank")


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    page_number: int
    text: str
    score: float
    rank: int


@dataclass
class RankingList:
    """A single ranked list of chunk_ids, best first."""

    chunk_ids: list[int] = field(default_factory=list)


def reciprocal_rank_fusion(rankings: list[list[int]], k: int = RRF_K) -> list[tuple[int, float]]:
    """Combine multiple ranked lists of chunk_ids into one fused ranking.

    RRF score for an item = sum over lists it appears in of 1 / (k + rank),
    where rank is 1-based position in that list. Items absent from a list
    contribute 0 for that list. Returns (chunk_id, fused_score) sorted
    descending by fused_score, ties broken by chunk_id ascending for
    determinism.
    """
    scores: dict[int, float] = {}
    for ranking in rankings:
        for idx, chunk_id in enumerate(ranking):
            rank = idx + 1
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    fused = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
    return fused


def _bm25_ranking(db: Session, org_id: int, document_ids: list[int] | None, query: str, limit: int) -> list[int]:
    doc_filter = ""
    params: dict = {"query": query, "org_id": org_id, "limit": limit}
    if document_ids:
        doc_filter = "AND c.document_id = ANY(:document_ids)"
        params["document_ids"] = document_ids

    sql = text(
        f"""
        SELECT c.id, ts_rank_cd(to_tsvector('english', c.text), plainto_tsquery('english', :query)) AS rank
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.org_id = :org_id
          AND to_tsvector('english', c.text) @@ plainto_tsquery('english', :query)
          {doc_filter}
        ORDER BY rank DESC
        LIMIT :limit
        """
    )
    rows = db.execute(sql, params).fetchall()
    return [row[0] for row in rows]


def _vector_ranking(
    db: Session, org_id: int, document_ids: list[int] | None, query_embedding: list[float], limit: int
) -> list[int]:
    doc_filter = ""
    params: dict = {"org_id": org_id, "limit": limit, "embedding": str(query_embedding)}
    if document_ids:
        doc_filter = "AND c.document_id = ANY(:document_ids)"
        params["document_ids"] = document_ids

    sql = text(
        f"""
        SELECT c.id
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.org_id = :org_id AND c.embedding IS NOT NULL
          {doc_filter}
        ORDER BY c.embedding <=> :embedding
        LIMIT :limit
        """
    )
    rows = db.execute(sql, params).fetchall()
    return [row[0] for row in rows]


def _fetch_chunk_texts(db: Session, chunk_ids: list[int]) -> dict[int, tuple[int, int, str]]:
    if not chunk_ids:
        return {}
    sql = text("SELECT id, document_id, page_number, text FROM chunks WHERE id = ANY(:ids)")
    rows = db.execute(sql, {"ids": chunk_ids}).fetchall()
    return {row[0]: (row[1], row[2], row[3]) for row in rows}


def retrieve(
    db: Session,
    org_id: int,
    question: str,
    document_ids: list[int] | None,
    retrieval_config: str = "hybrid+rerank",
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    settings = get_settings()
    top_k = top_k or settings.rerank_top_k
    candidate_k = settings.hybrid_candidate_k

    if retrieval_config not in RETRIEVAL_CONFIGS:
        raise ValueError(f"unknown retrieval_config: {retrieval_config}")

    query_embedding = embed_query(question)
    vector_ranking = _vector_ranking(db, org_id, document_ids, query_embedding, limit=candidate_k)

    if retrieval_config == "vector_only":
        fused_ids = vector_ranking[:top_k]
        fused_scores = {cid: 1.0 / (i + 1) for i, cid in enumerate(fused_ids)}
    else:
        bm25_ranking = _bm25_ranking(db, org_id, document_ids, question, limit=candidate_k)
        fused = reciprocal_rank_fusion([vector_ranking, bm25_ranking])
        fused_ids = [cid for cid, _ in fused[:candidate_k]]
        fused_scores = dict(fused)

        if retrieval_config == "hybrid+rerank" and fused_ids:
            texts_by_id = _fetch_chunk_texts(db, fused_ids)
            candidates = [(cid, texts_by_id[cid][2]) for cid in fused_ids if cid in texts_by_id]
            reranked = cross_encoder_rerank(question, candidates, top_k=top_k)
            fused_ids = [cid for cid, _ in reranked]
            fused_scores = dict(reranked)
        else:
            fused_ids = fused_ids[:top_k]

    chunk_meta = _fetch_chunk_texts(db, fused_ids)
    results: list[RetrievedChunk] = []
    for i, cid in enumerate(fused_ids):
        if cid not in chunk_meta:
            continue
        doc_id, page_number, chunk_text = chunk_meta[cid]
        results.append(
            RetrievedChunk(
                chunk_id=cid,
                document_id=doc_id,
                page_number=page_number,
                text=chunk_text,
                score=fused_scores.get(cid, 0.0),
                rank=i + 1,
            )
        )
    return results
