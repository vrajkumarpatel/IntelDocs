import enum
from datetime import datetime, timezone

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.database import Base

settings = get_settings()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Role(str, enum.Enum):
    admin = "admin"
    member = "member"


class DocumentStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    failed = "failed"


class EvalRunStatus(str, enum.Enum):
    running = "running"
    completed = "completed"
    failed = "failed"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default=Role.member.value, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped["Organization"] = relationship(back_populates="users")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=DocumentStatus.processing.value, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    parent_document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Not in SPEC.md's data model table; needed so a failed OCR/embedding job
    # can surface *why* status="failed" via GET /documents/{id}. Documented
    # deviation, additive only.
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Storage path for the uploaded original file, needed by the worker to
    # actually read bytes to OCR/parse. Additive, not in SPEC's table.
    storage_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete-orphan")
    summary: Mapped["DocumentSummary | None"] = relationship(back_populates="document", uselist=False, cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, index=True)
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(settings.embedding_dim), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    document: Mapped["Document"] = relationship(back_populates="chunks")


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    retrieval_config: Mapped[str] = mapped_column(String(50), nullable=False)
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class DocumentSummary(Base):
    __tablename__ = "document_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("documents.id"), nullable=False, unique=True)
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    key_clauses: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    document: Mapped["Document"] = relationship(back_populates="summary")


class ComparisonResult(Base):
    __tablename__ = "comparison_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    document_ids: Mapped[list] = mapped_column(JSON, default=list)
    comparison_text: Mapped[str] = mapped_column(Text, nullable=False)
    differences: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EvalRun(Base):
    __tablename__ = "eval_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    org_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)
    retrieval_config: Mapped[str] = mapped_column(String(50), nullable=False)
    document_ids: Mapped[list] = mapped_column(JSON, default=list)
    num_questions: Mapped[int] = mapped_column(Integer, default=0)
    retrieval_hit_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    retrieval_mrr: Mapped[float | None] = mapped_column(Float, nullable=True)
    answer_faithfulness_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Not listed in SPEC.md's EvalRun data-model row, but required by the API
    # contract ("returns the EvalRun with status: 'running'"). Documented,
    # additive deviation.
    status: Mapped[str] = mapped_column(String(20), default=EvalRunStatus.running.value, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    questions: Mapped[list["EvalQuestion"]] = relationship(back_populates="eval_run", cascade="all, delete-orphan")


class EvalQuestion(Base):
    __tablename__ = "eval_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    eval_run_id: Mapped[int] = mapped_column(ForeignKey("eval_runs.id"), nullable=False, index=True)
    source_chunk_id: Mapped[int] = mapped_column(ForeignKey("chunks.id"), nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    retrieved_chunk_ids: Mapped[list] = mapped_column(JSON, default=list)
    hit: Mapped[bool] = mapped_column(Boolean, default=False)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    generated_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    faithfulness_verdict: Mapped[str | None] = mapped_column(String(20), nullable=True)
    faithfulness_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    eval_run: Mapped["EvalRun"] = relationship(back_populates="questions")
