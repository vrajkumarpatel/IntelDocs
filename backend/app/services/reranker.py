"""Local cross-encoder reranker (no paid API)."""

import threading

from sentence_transformers import CrossEncoder

from app.config import get_settings

_model: CrossEncoder | None = None
_lock = threading.Lock()


def get_reranker() -> CrossEncoder:
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                settings = get_settings()
                _model = CrossEncoder(settings.reranker_model)
    return _model


def rerank(query: str, candidates: list[tuple[int, str]], top_k: int) -> list[tuple[int, float]]:
    """candidates: list of (chunk_id, text). Returns top_k (chunk_id, score)
    sorted descending by cross-encoder relevance score."""
    if not candidates:
        return []
    model = get_reranker()
    pairs = [[query, text] for _, text in candidates]
    scores = model.predict(pairs)
    scored = list(zip([c[0] for c in candidates], (float(s) for s in scores)))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]
