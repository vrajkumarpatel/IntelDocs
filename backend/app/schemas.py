from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    org_name: str
    email: EmailStr
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    org_id: int
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Documents ----------
class DocumentOut(BaseModel):
    id: int
    org_id: int
    filename: str
    content_type: str
    status: str
    version: int
    parent_document_id: int | None
    page_count: int | None
    uploaded_by: int
    created_at: datetime
    error_message: str | None = None

    model_config = {"from_attributes": True}


class DocumentDetailOut(DocumentOut):
    summary: "DocumentSummaryOut | None" = None


class DocumentListOut(BaseModel):
    items: list[DocumentOut]
    total: int
    page: int
    page_size: int


class DocumentVersionsOut(BaseModel):
    items: list[DocumentOut]


# ---------- Query / Q&A ----------
class QueryRequest(BaseModel):
    question: str
    document_ids: list[int] | None = None
    retrieval_config: str = "hybrid+rerank"


class Citation(BaseModel):
    chunk_id: int
    document_id: int
    page_number: int
    snippet: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    confidence: float
    model_used: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int
    retrieval_config: str


class QueryLogOut(BaseModel):
    id: int
    question: str
    answer: str
    citations: list
    retrieval_config: str
    model_used: str
    prompt_tokens: int
    completion_tokens: int
    latency_ms: int
    created_at: datetime

    model_config = {"from_attributes": True}


class QueryLogListOut(BaseModel):
    items: list[QueryLogOut]
    total: int
    page: int
    page_size: int


# ---------- Summarization ----------
class KeyClause(BaseModel):
    clause_type: str
    text: str
    risk_level: str


class DocumentSummaryOut(BaseModel):
    id: int
    document_id: int
    summary_text: str
    key_clauses: list[KeyClause]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Comparison ----------
class CompareRequest(BaseModel):
    document_ids: list[int] = Field(min_length=2)


class Difference(BaseModel):
    aspect: str
    doc_a_value: str
    doc_b_value: str


class ComparisonResultOut(BaseModel):
    id: int
    document_ids: list[int]
    comparison_text: str
    differences: list[Difference]
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Eval ----------
class EvalRunRequest(BaseModel):
    document_ids: list[int]
    num_questions_per_doc: int = 3
    retrieval_config: str = "hybrid+rerank"


class EvalQuestionOut(BaseModel):
    id: int
    source_chunk_id: int
    question: str
    retrieved_chunk_ids: list
    hit: bool
    rank: int | None
    generated_answer: str | None
    faithfulness_verdict: str | None
    faithfulness_reasoning: str | None

    model_config = {"from_attributes": True}


class EvalRunOut(BaseModel):
    id: int
    org_id: int
    retrieval_config: str
    document_ids: list
    num_questions: int
    retrieval_hit_rate: float | None
    retrieval_mrr: float | None
    answer_faithfulness_rate: float | None
    avg_latency_ms: float | None
    status: str
    error_message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EvalRunDetailOut(EvalRunOut):
    questions: list[EvalQuestionOut] = []


class EvalRunListOut(BaseModel):
    items: list[EvalRunOut]
    total: int
    page: int
    page_size: int


# ---------- Admin ----------
class DailyUsage(BaseModel):
    day: str
    documents_processed: int
    queries_run: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float


class UsageOut(BaseModel):
    total_documents: int
    total_queries: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_estimated_cost_usd: float
    by_day: list[DailyUsage]
