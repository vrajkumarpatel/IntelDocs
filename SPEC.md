# IntelDocs — Spec

A document intelligence platform: upload contracts/invoices/policies/PDFs (scanned or native), get hybrid-search-backed cited Q&A, document comparison, clause/risk flagging, and summarization — plus an automated evaluation pipeline that measures whether the retrieval and answers are actually correct. This is the fixed contract both backend and frontend build against. Do not deviate without updating this file first.

**Scope discipline**: the core pipeline (ingest → OCR → chunk/index → hybrid retrieval → cited Q&A → evaluation) must be deep and genuinely working. Comparison, clause/risk detection, and summarization are real but secondary — implement them, but the core must not be shortchanged to make room for them. No paid APIs: embeddings and reranking run on local open-source models (sentence-transformers), the LLM is Groq (free tier). OCR is Tesseract (local, free).

## Workflow

```
Upload (PDF/image) → OCR (if scanned) → chunk → embed (local model) → index (pgvector + BM25)
  → [query] → hybrid retrieval → rerank (local cross-encoder) → LLM answer w/ citations
  → [eval mode] → auto-generate test questions per doc → run retrieval+answer → score → track over time
```

## Data Model

**Organization** — `id`, `name`, `created_at` (multi-tenant boundary; documents/users belong to one org)

**User** — `id`, `org_id` (FK), `email`, `password_hash`, `role` (`admin` | `member`), `created_at`

**Document** — `id`, `org_id` (FK), `filename`, `content_type`, `status` (`processing`|`ready`|`failed`), `version` (int, starts at 1), `parent_document_id` (FK, nullable — set when this is a new version of an earlier doc), `page_count`, `uploaded_by` (FK User), `created_at`

**Chunk** — `id`, `document_id` (FK), `page_number`, `chunk_index`, `text`, `embedding` (pgvector), `created_at`

**QueryLog** — `id`, `org_id` (FK), `user_id` (FK), `question`, `answer`, `citations` (JSON: list of `{chunk_id, document_id, page_number, snippet}`), `retrieval_config` (str — e.g. `"hybrid+rerank"`, `"vector_only"`), `model_used`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `created_at`

**DocumentSummary** — `id`, `document_id` (FK), `summary_text`, `key_clauses` (JSON: list of `{clause_type, text, risk_level}`), `created_at`

**ComparisonResult** — `id`, `org_id` (FK), `document_ids` (JSON list of FKs), `comparison_text`, `differences` (JSON: list of `{aspect, doc_a_value, doc_b_value}`), `created_at`

**EvalRun** — `id`, `org_id` (FK), `retrieval_config` (str), `document_ids` (JSON list — corpus used), `num_questions`, `retrieval_hit_rate` (float 0-1 — ground-truth chunk found in top-K), `retrieval_mrr` (float), `answer_faithfulness_rate` (float 0-1 — LLM-judged), `avg_latency_ms`, `created_at`

**EvalQuestion** — `id`, `eval_run_id` (FK), `source_chunk_id` (FK — ground truth), `question`, `retrieved_chunk_ids` (JSON list, ranked), `hit` (bool — was source_chunk_id in top-K), `rank` (int, nullable — position if hit), `generated_answer`, `faithfulness_verdict` (`faithful`|`unfaithful`|`partial`), `faithfulness_reasoning`, `created_at`

## API (`/api/v1`, JWT auth on everything except `/health` and `/auth/*`)

- `POST /api/v1/auth/register` — first user in a new org (creates Organization + admin User)
- `POST /api/v1/auth/login` → `{access_token}`
- `POST /api/v1/documents` — multipart upload; creates a `processing` Document, queues an async job (Celery/ARQ) for OCR + chunk + embed + index; returns the Document immediately with `status: "processing"`
- `GET /api/v1/documents` — paginated list (org-scoped)
- `GET /api/v1/documents/{id}` — detail incl. status, page_count, version, summary if generated
- `POST /api/v1/documents/{id}/reupload` — uploads a new version, links via `parent_document_id`, increments `version`
- `GET /api/v1/documents/{id}/versions` — version history chain
- `POST /api/v1/query` — `{question, document_ids?: [int]}` (optional scoping to specific docs, else org-wide) → hybrid retrieval + rerank + LLM answer with citations; logs a `QueryLog`
- `GET /api/v1/queries` — paginated QueryLog history
- `POST /api/v1/documents/{id}/summarize` — generates/returns a `DocumentSummary` (summary + extracted clauses with risk levels)
- `POST /api/v1/compare` — `{document_ids: [int, int, ...]}` → `ComparisonResult`
- `POST /api/v1/eval/runs` — `{document_ids: [int], num_questions_per_doc: int, retrieval_config: str}` → kicks off an async eval run (generate questions, run retrieval+answer, score), returns the `EvalRun` with `status: "running"`
- `GET /api/v1/eval/runs` — paginated list of past eval runs (for comparing configs/models over time)
- `GET /api/v1/eval/runs/{id}` — run detail + all `EvalQuestion` results
- `GET /api/v1/admin/usage` — org-wide usage: documents processed, queries run, total tokens, estimated cost, by day (admin role only)
- `GET /health` — no auth

Errors: standard `{"detail": ...}` with correct status codes; never leak stack traces.

## Retrieval Contract

1. **Chunking**: split document text into ~300-500 token chunks with a small overlap, tracking page number per chunk.
2. **Embedding**: local `sentence-transformers` model (e.g. `all-MiniLM-L6-v2`) — no paid embedding API. Store vectors in pgvector.
3. **Hybrid retrieval**: combine BM25 (Postgres full-text search or `rank_bm25` in-process) with vector cosine similarity — reciprocal rank fusion across both result lists to produce a combined ranking.
4. **Reranking**: take the top ~20 hybrid results, rerank with a local cross-encoder (e.g. `cross-encoder/ms-marco-MiniLM-L-6-v2`) down to the top ~5-8 passed to the LLM.
5. **Answer generation**: Groq call with the reranked chunks as context, prompted to return structured JSON: `{answer, citations: [{chunk_id, page_number, snippet}], confidence}`. Every citation must reference a chunk actually provided as context — do not let the LLM invent a citation to a chunk it wasn't given.

## Evaluation Pipeline (the differentiator — implement this for real, not superficially)

Given a set of documents:
1. **Question generation**: for a sample of chunks (not necessarily all — keep this bounded, e.g. up to `num_questions_per_doc` per document), prompt the LLM to generate one realistic question that chunk answers. That chunk is the ground truth for that question.
2. **Retrieval evaluation**: run the actual hybrid retrieval pipeline for each generated question. Check whether the ground-truth chunk appears in the top-K retrieved results (**hit rate**) and at what rank (**MRR** — mean reciprocal rank across all questions).
3. **Answer evaluation**: run the full answer-generation pipeline for each question. Use a second LLM call (LLM-as-judge) to classify the answer as `faithful` (fully supported by the cited chunks), `unfaithful` (contradicts or invents beyond the chunks), or `partial`, with a short reasoning string.
4. **Aggregate and store**: an `EvalRun` records the retrieval config used (e.g. `"vector_only"` vs `"hybrid"` vs `"hybrid+rerank"`), so a user can run the same document set through different configs and see which one actually performs better — this comparative angle is the point, not just a single score.

This must actually run and produce real, varying numbers on real test data — not a hardcoded/fake score.

## Demo Mode

No paid services required: Groq is free-tier (a `GROQ_API_KEY` env var; without one, LLM-dependent features return a clear "AI features unavailable" error rather than crashing — unlike LeadTriage, there isn't a sensible non-LLM fallback for cited Q&A, so be upfront about this rather than faking it). Embeddings, reranking, and OCR all run locally with zero API keys needed regardless.

## Infra

- Docker Compose: API, PostgreSQL (with pgvector extension), Redis, a Celery or ARQ worker for async document processing and eval runs.
- `.env.example` for every required var.
