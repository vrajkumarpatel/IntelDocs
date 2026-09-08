import axios, { type AxiosError } from 'axios'
import type {
  AdminUsage,
  AuthResponse,
  ComparisonResult,
  CompareRequest,
  DocumentDetail,
  DocumentRecord,
  DocumentSummary,
  EvalRun,
  EvalRunDetail,
  EvalRunRequest,
  LoginRequest,
  Paginated,
  QueryLog,
  QueryRequest,
  QueryResponse,
  RegisterRequest,
} from '../types'
import { clearToken, getToken } from './token'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export const client = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
})

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

/** Notified on a 401 so the app shell can redirect to /login without each
 *  call site needing to know about auth plumbing. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken()
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail
    if (typeof detail === 'string') return detail
    if (error.message) return error.message
  }
  return fallback
}

// ---- auth ----

export async function register(payload: RegisterRequest): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/register', payload)
  return data
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const { data } = await client.post<AuthResponse>('/auth/login', payload)
  return data
}

// ---- documents ----

export async function listDocuments(page = 1, pageSize = 20): Promise<Paginated<DocumentRecord>> {
  const { data } = await client.get<Paginated<DocumentRecord>>('/documents', {
    params: { page, page_size: pageSize },
  })
  return data
}

export async function getDocument(id: number): Promise<DocumentDetail> {
  const { data } = await client.get<DocumentDetail>(`/documents/${id}`)
  return data
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<DocumentRecord>('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function reuploadDocument(id: number, file: File): Promise<DocumentRecord> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post<DocumentRecord>(`/documents/${id}/reupload`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getDocumentVersions(id: number): Promise<DocumentRecord[]> {
  const { data } = await client.get<DocumentRecord[]>(`/documents/${id}/versions`)
  return data
}

export async function summarizeDocument(id: number): Promise<DocumentSummary> {
  const { data } = await client.post<DocumentSummary>(`/documents/${id}/summarize`)
  return data
}

// ---- query / ask ----

export async function askQuestion(payload: QueryRequest): Promise<QueryResponse> {
  const { data } = await client.post<QueryResponse>('/query', payload)
  return data
}

export async function listQueries(page = 1, pageSize = 20): Promise<Paginated<QueryLog>> {
  const { data } = await client.get<Paginated<QueryLog>>('/queries', {
    params: { page, page_size: pageSize },
  })
  return data
}

// ---- compare ----

export async function compareDocuments(payload: CompareRequest): Promise<ComparisonResult> {
  const { data } = await client.post<ComparisonResult>('/compare', payload)
  return data
}

// ---- evaluation ----

export async function createEvalRun(payload: EvalRunRequest): Promise<EvalRun> {
  const { data } = await client.post<EvalRun>('/eval/runs', payload)
  return data
}

export async function listEvalRuns(page = 1, pageSize = 20): Promise<Paginated<EvalRun>> {
  const { data } = await client.get<Paginated<EvalRun>>('/eval/runs', {
    params: { page, page_size: pageSize },
  })
  return data
}

export async function getEvalRun(id: number): Promise<EvalRunDetail> {
  const { data } = await client.get<EvalRunDetail>(`/eval/runs/${id}`)
  return data
}

// ---- admin ----

export async function getAdminUsage(): Promise<AdminUsage> {
  const { data } = await client.get<AdminUsage>('/admin/usage')
  return data
}
