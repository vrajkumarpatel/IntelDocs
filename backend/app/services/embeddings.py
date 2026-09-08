"""Local embedding model wrapper (no paid API). Loaded lazily and cached as a
process-wide singleton so the worker/API don't reload weights per call."""

import threading

from sentence_transformers import SentenceTransformer

from app.config import get_settings

_model: SentenceTransformer | None = None
_lock = threading.Lock()


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                settings = get_settings()
                _model = SentenceTransformer(settings.embedding_model)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    model = get_embedding_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [v.tolist() for v in vectors]


def embed_query(text: str) -> list[float]:
    return embed_texts([text])[0]
