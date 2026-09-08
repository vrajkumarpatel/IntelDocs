import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, FileText, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { DocumentPicker } from '../components/DocumentPicker'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { DocumentStatusBadge } from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage, getDocument, getDocumentVersions, listDocuments, summarizeDocument } from '../lib/api'
import { riskBadge } from '../lib/badges'
import { formatDate } from '../lib/format'
import { POLL_INTERVAL_MS } from '../lib/queryClient'

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const docId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { push } = useToast()
  const [showComparePicker, setShowComparePicker] = useState(false)
  const [compareTarget, setCompareTarget] = useState<number | null>(null)

  const { data: doc, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => getDocument(docId),
    enabled: Number.isFinite(docId),
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? POLL_INTERVAL_MS : false),
  })

  const { data: versions } = useQuery({
    queryKey: ['document-versions', docId],
    queryFn: () => getDocumentVersions(docId),
    enabled: Number.isFinite(docId),
  })

  const { data: allDocs } = useQuery({
    queryKey: ['documents', 'for-compare'],
    queryFn: () => listDocuments(1, 100),
    enabled: showComparePicker,
  })

  const summarizeMutation = useMutation({
    mutationFn: () => summarizeDocument(docId),
    onSuccess: () => {
      push('success', 'Summary generated.')
      queryClient.invalidateQueries({ queryKey: ['document', docId] })
    },
    onError: (err) => push('error', apiErrorMessage(err, 'Could not generate a summary.')),
  })

  if (isLoading) return <LoadingState label="Loading document…" />
  if (isError || !doc) return <ErrorState message={apiErrorMessage(error, 'Document not found.')} retry={() => refetch()} />

  return (
    <div>
      <Link
        to="/documents"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All documents
      </Link>

      <PageHeader
        eyebrow={`Document #${doc.id}`}
        title={doc.filename}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowComparePicker((v) => !v)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-paper)]"
            >
              Compare with…
            </button>
            <button
              type="button"
              disabled={doc.status !== 'ready' || summarizeMutation.isPending}
              onClick={() => summarizeMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {summarizeMutation.isPending
                ? 'Summarizing…'
                : doc.summary
                  ? 'Re-summarize'
                  : 'Summarize'}
            </button>
          </>
        }
      />

      {doc.status === 'processing' && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-status-processing-soft)] px-4 py-3 text-sm text-[var(--color-status-processing)]">
          Still processing — OCR, chunking, and indexing run asynchronously. This page updates automatically.
        </div>
      )}
      {doc.status === 'failed' && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--color-status-failed)]/30 bg-[var(--color-status-failed-soft)] px-4 py-3 text-sm text-[var(--color-status-failed)]">
          <AlertTriangle className="h-4 w-4" />
          Processing failed for this document. Try re-uploading it.
        </div>
      )}

      {showComparePicker && (
        <Card className="mb-6 p-4">
          <p className="mb-2 text-sm font-medium text-[var(--color-text)]">Choose a document to compare against</p>
          <DocumentPicker
            documents={(allDocs?.items ?? []).filter((d) => d.id !== doc.id)}
            selected={compareTarget ? [compareTarget] : []}
            onToggle={(otherId) => setCompareTarget(otherId === compareTarget ? null : otherId)}
          />
          <button
            type="button"
            disabled={!compareTarget}
            onClick={() => navigate(`/compare?doc=${doc.id}&doc=${compareTarget}`)}
            className="mt-3 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Compare
          </button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">Details</p>
          <dl className="space-y-3 text-sm">
            <Row label="Status"><DocumentStatusBadge status={doc.status} /></Row>
            <Row label="Pages">{doc.page_count ?? '—'}</Row>
            <Row label="Version">v{doc.version}</Row>
            <Row label="Content type"><span className="font-mono text-xs">{doc.content_type}</span></Row>
            <Row label="Uploaded">{formatDate(doc.created_at)}</Row>
          </dl>

          {versions && versions.length > 1 && (
            <div className="mt-5 border-t border-[var(--color-border-soft)] pt-4">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
                Version history
              </p>
              <ul className="space-y-1.5">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <Link
                      to={`/documents/${v.id}`}
                      className={v.id === doc.id ? 'font-medium text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}
                    >
                      v{v.version}
                    </Link>
                    <span className="font-mono text-xs text-[var(--color-text-faint)]">{formatDate(v.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2">
          {doc.summary ? (
            <Card className="p-5">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">Summary</p>
              <p className="text-sm leading-relaxed text-[var(--color-text)]">{doc.summary.summary_text}</p>

              {doc.summary.key_clauses.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
                    Key clauses
                  </p>
                  <ul className="space-y-2">
                    {doc.summary.key_clauses.map((clause, i) => (
                      <li key={i} className="rounded-lg border border-[var(--color-border)] p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text)]">{clause.clause_type}</span>
                          <Badge style={riskBadge(clause.risk_level)} />
                        </div>
                        <p className="text-sm text-[var(--color-text-muted)]">{clause.text}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center gap-2 p-10 text-center">
              <FileText className="h-6 w-6 text-[var(--color-text-faint)]" />
              <p className="text-sm text-[var(--color-text-muted)]">
                {doc.status === 'ready'
                  ? 'No summary generated yet — click Summarize to extract clauses and risk flags.'
                  : 'Summarization is available once this document finishes processing.'}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-right text-[var(--color-text)]">{children}</dd>
    </div>
  )
}
