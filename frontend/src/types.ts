// TypeScript types mirroring IntelDocs SPEC.md's data model exactly.
// Do not add fields that are not in SPEC.md — it is the fixed contract.

export type UserRole = 'admin' | 'member'

export interface Organization {
  id: number
  name: string
  created_at: string
}

export interface User {
  id: number
  org_id: number
  email: string
  role: UserRole
  created_at: string
}

export type DocumentStatus = 'processing' | 'ready' | 'failed'

export interface DocumentRecord {
  id: number
  org_id: number
  filename: string
  content_type: string
  status: DocumentStatus
  version: number
  parent_document_id: number | null
  page_count: number | null
  uploaded_by: number
  created_at: string
}

export interface Chunk {
  id: number
  document_id: number
  page_number: number
  chunk_index: number
  text: string
  created_at: string
}

/** GET /api/v1/documents/{id} response — detail incl. summary if generated. */
export interface DocumentDetail extends DocumentRecord {
  summary: DocumentSummary | null
}

/** Citation shape embedded in QueryLog.citations and query-answer responses. */
export interface Citation {
  chunk_id: number
  document_id: number
  page_number: number
  snippet: string
}

export interface QueryLog {
  id: number
  org_id: number
  user_id: number
  question: string
  answer: string
  citations: Citation[]
  retrieval_config: string
  model_used: string
  prompt_tokens: number
  completion_tokens: number
  latency_ms: number
  created_at: string
}

/** Response body of POST /api/v1/query. */
export interface QueryResponse {
  id: number
  question: string
  answer: string
  citations: Citation[]
  confidence: number
  retrieval_config: string
  model_used: string
  prompt_tokens: number
  completion_tokens: number
  latency_ms: number
  created_at: string
}

export type RiskLevel = 'low' | 'medium' | 'high'

export interface KeyClause {
  clause_type: string
  text: string
  risk_level: RiskLevel
}

export interface DocumentSummary {
  id: number
  document_id: number
  summary_text: string
  key_clauses: KeyClause[]
  created_at: string
}

export interface Difference {
  aspect: string
  doc_a_value: string
  doc_b_value: string
}

export interface ComparisonResult {
  id: number
  org_id: number
  document_ids: number[]
  comparison_text: string
  differences: Difference[]
  created_at: string
}

export type EvalRunStatus = 'running' | 'complete' | 'failed'

export interface EvalRun {
  id: number
  org_id: number
  retrieval_config: string
  document_ids: number[]
  num_questions: number
  retrieval_hit_rate: number | null
  retrieval_mrr: number | null
  answer_faithfulness_rate: number | null
  avg_latency_ms: number | null
  status?: EvalRunStatus
  created_at: string
}

export type FaithfulnessVerdict = 'faithful' | 'unfaithful' | 'partial'

export interface EvalQuestion {
  id: number
  eval_run_id: number
  source_chunk_id: number
  question: string
  retrieved_chunk_ids: number[]
  hit: boolean
  rank: number | null
  generated_answer: string
  faithfulness_verdict: FaithfulnessVerdict
  faithfulness_reasoning: string
  created_at: string
}

export interface EvalRunDetail extends EvalRun {
  questions: EvalQuestion[]
}

export interface UsageByDay {
  date: string
  documents_processed: number
  queries_run: number
  total_tokens: number
  estimated_cost_usd: number
}

export interface AdminUsage {
  documents_processed: number
  queries_run: number
  total_tokens: number
  estimated_cost_usd: number
  by_day: UsageByDay[]
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---- Request payloads ----

export interface RegisterRequest {
  org_name: string
  email: string
  password: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
}

export interface QueryRequest {
  question: string
  document_ids?: number[]
}

export interface CompareRequest {
  document_ids: number[]
}

export interface EvalRunRequest {
  document_ids: number[]
  num_questions_per_doc: number
  retrieval_config: string
}

export interface ApiError {
  detail: string
}
