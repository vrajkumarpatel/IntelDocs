import { useMutation, useQuery } from '@tanstack/react-query'
import { Gauge, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../components/Card'
import { CitationAnswer } from '../components/CitationAnswer'
import { DocumentPicker } from '../components/DocumentPicker'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { apiErrorMessage, askQuestion, listDocuments } from '../lib/api'
import { formatMs, formatPercent } from '../lib/format'
import type { QueryResponse } from '../types'

export function Ask() {
  const [question, setQuestion] = useState('')
  const [scopeIds, setScopeIds] = useState<number[]>([])
  const [showScope, setShowScope] = useState(false)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const navigate = useNavigate()

  const { data: docsPage } = useQuery({
    queryKey: ['documents', 'for-ask'],
    queryFn: () => listDocuments(1, 100),
  })

  const readyDocs = (docsPage?.items ?? []).filter((d) => d.status === 'ready')

  const mutation = useMutation({
    mutationFn: askQuestion,
    onSuccess: (data) => setResult(data),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    mutation.mutate({ question: question.trim(), document_ids: scopeIds.length ? scopeIds : undefined })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Cited Q&A"
        title="Ask"
        description="Ask a question against your document corpus. Every claim in the answer links back to the exact page it came from."
      />

      <Card className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What's the termination notice period in the vendor agreement?"
            rows={3}
            className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[15px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
          />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowScope((v) => !v)}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              {scopeIds.length > 0 ? `Scoped to ${scopeIds.length} document(s)` : 'Scope to specific documents (optional)'}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !question.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? 'Thinking…' : 'Ask'}
            </button>
          </div>

          {showScope && (
            <div className="pt-1">
              <DocumentPicker
                documents={readyDocs}
                selected={scopeIds}
                onToggle={(id) =>
                  setScopeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                emptyLabel="No ready documents to scope to yet — org-wide search will be used."
              />
            </div>
          )}
        </form>
      </Card>

      <div className="mt-6">
        {mutation.isPending && <LoadingState label="Retrieving, reranking, and generating an answer…" />}

        {mutation.isError && (
          <ErrorState message={apiErrorMessage(mutation.error, 'Could not get an answer.')} retry={() => mutation.mutate({ question, document_ids: scopeIds.length ? scopeIds : undefined })} />
        )}

        {result && !mutation.isPending && (
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border-soft)] pb-4">
              <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-text-faint)]">
                <Gauge className="h-3.5 w-3.5" />
                {result.retrieval_config} &middot; {result.model_used} &middot; {formatMs(result.latency_ms)}
              </div>
              <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--color-primary-hover)]">
                confidence {formatPercent(result.confidence)}
              </span>
            </div>

            <CitationAnswer
              answer={result.answer}
              citations={result.citations}
              onOpenDocument={(documentId) => navigate(`/documents/${documentId}`)}
            />
          </Card>
        )}

        {!result && !mutation.isPending && !mutation.isError && (
          <p className="text-center text-sm text-[var(--color-text-faint)]">
            Answers appear here with clickable citations back to the source page.
          </p>
        )}
      </div>
    </div>
  )
}
