from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://intel:intel@localhost:5432/inteldocs"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    groq_api_key: str = ""
    # NOTE: SPEC/CLAUDE.md originally called for "llama-3.3-70b-versatile",
    # which Groq has since decommissioned (verified live against the Groq
    # API during development -- returns 404 model_not_found). Substituted
    # with "openai/gpt-oss-120b", Groq's current free-tier flagship
    # open-weights model with equivalent JSON-mode support. Documented
    # deviation, not a silent swap.
    groq_model: str = "openai/gpt-oss-120b"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    embedding_dim: int = 384
    reranker_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    tesseract_cmd: str = "tesseract"
    storage_dir: str = "./storage"

    environment: str = "development"
    log_level: str = "INFO"

    # Retrieval tuning
    chunk_min_tokens: int = 300
    chunk_max_tokens: int = 500
    chunk_overlap_tokens: int = 50
    hybrid_candidate_k: int = 20
    rerank_top_k: int = 8

    # Groq pricing is $0 on free tier; kept for admin cost-estimate display only.
    groq_cost_per_1k_prompt_tokens: float = 0.0
    groq_cost_per_1k_completion_tokens: float = 0.0

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
