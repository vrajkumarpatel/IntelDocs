import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge } from '../components/Badge'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { EvalRunStatusBadge } from '../components/StatusBadge'
import { apiErrorMessage, getEvalRun } from '../lib/api'
import { verdictBadge } from '../lib/badges'
import { formatDate, formatMrr, formatMs, formatPercent } from '../lib/format'
import { POLL_INTERVAL_MS } from '../lib/queryClient'
import type { EvalQuestion } from '../types'

export function EvalRunDetail() {
  const { id } = useParams<{ id: string }>()
  const runId = Number(id)
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: run, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['eval-run', runId],
    queryFn: () => getEvalRun(runId),
    enabled: Number.isFinite(runId),
    refetchInterval: (query) => (query.state.data?.retrieval_hit_rate === null ? POLL_INTERVAL_MS : false),
  })

  if (isLoading) return <LoadingState label="Loading eval run…" />
  if (isError || !run) return <ErrorState message={apiErrorMessage(error, 'Eval run not found.')} retry={() => refetch()} />

  const questions = run.questions ?? []
  const isRunning = run.retrieval_hit_rate === null

  return (
    <div>
      <Link to="/evaluation" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="h-3.5 w-3.5" />
        All eval runs
      </Link>

      <PageHeader
        eyebrow={`${run.retrieval_config} · ${run.document_ids.length} document(s)`}
        title={`Eval run #${run.id}`}
        description={`${run.num_questions} generated question(s), scored ${formatDate(run.created_at)}.`}
        actions={<EvalRunStatusBadge status={run.status} hitRate={run.retrieval_hit_rate} />}
      />

      {isRunning && (
        <div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-status-processing-soft)] px-4 py-3 text-sm text-[var(--color-status-processing)]">
          Generating questions and scoring retrieval + answers — this page updates automatically.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Hit rate" value={formatPercent(run.retrieval_hit_rate)} />
        <MetricTile label="MRR" value={formatMrr(run.retrieval_mrr)} />
        <MetricTile label="Faithfulness" value={formatPercent(run.answer_faithfulness_rate)} />
        <MetricTile label="Avg latency" value={formatMs(run.avg_latency_ms)} />
      </div>

      <Card className="p-0">
        {questions.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No question results yet" description="Individual question scoring will appear here once the run completes." />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border-soft)]">
            {questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                expanded={expanded === q.id}
                onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">{label}</p>
      <p className="font-mono text-2xl font-semibold text-[var(--color-text)]">{value}</p>
    </Card>
  )
}

function QuestionRow({
  question,
  expanded,
  onToggle,
}: {
  question: EvalQuestion
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <li>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-[var(--color-paper)]">
        {question.hit ? (
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-ready)]" />
        ) : (
          <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-failed)]" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--color-text)]">{question.question}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[var(--color-text-faint)]">
            <span>{question.hit ? `hit @ rank ${question.rank}` : 'miss'}</span>
            <span>chunk #{question.source_chunk_id}</span>
          </span>
        </span>
        <Badge style={verdictBadge(question.faithfulness_verdict)} />
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border-soft)] bg-[var(--color-paper)] px-4 py-4">
          <div className="mb-3">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">Generated answer</p>
            <p className="text-sm text-[var(--color-text)]">{question.generated_answer}</p>
          </div>
          <div className="mb-3">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">Faithfulness reasoning</p>
            <p className="text-sm text-[var(--color-text-muted)]">{question.faithfulness_reasoning}</p>
          </div>
          <div>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
              Retrieved chunks (ranked)
            </p>
            <p className="font-mono text-xs text-[var(--color-text-muted)]">
              {question.retrieved_chunk_ids.join(', ') || '—'}
            </p>
          </div>
        </div>
      )}
    </li>
  )
}
