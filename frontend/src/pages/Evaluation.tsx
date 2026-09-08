import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScanSearch } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { DocumentPicker } from '../components/DocumentPicker'
import { EvalRunChart } from '../components/EvalRunChart'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { EvalRunStatusBadge } from '../components/StatusBadge'
import { useToast } from '../context/ToastContext'
import { apiErrorMessage, createEvalRun, listDocuments, listEvalRuns } from '../lib/api'
import { formatMrr, formatMs, formatPercent } from '../lib/format'
import { POLL_INTERVAL_MS } from '../lib/queryClient'

const RETRIEVAL_CONFIGS = ['vector_only', 'hybrid', 'hybrid+rerank']

export function Evaluation() {
  const [docIds, setDocIds] = useState<number[]>([])
  const [numQuestions, setNumQuestions] = useState(5)
  const [config, setConfig] = useState(RETRIEVAL_CONFIGS[2])
  const queryClient = useQueryClient()
  const { push } = useToast()

  const { data: docsPage } = useQuery({
    queryKey: ['documents', 'for-eval'],
    queryFn: () => listDocuments(1, 100),
  })
  const readyDocs = (docsPage?.items ?? []).filter((d) => d.status === 'ready')

  const { data: runsPage, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['eval-runs'],
    queryFn: () => listEvalRuns(1, 50),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((r) => r.retrieval_hit_rate === null) ? POLL_INTERVAL_MS : false
    },
  })

  const createMutation = useMutation({
    mutationFn: createEvalRun,
    onSuccess: () => {
      push('success', 'Eval run started — questions are being generated and scored.')
      setDocIds([])
      queryClient.invalidateQueries({ queryKey: ['eval-runs'] })
    },
    onError: (err) => push('error', apiErrorMessage(err, 'Could not start the eval run.')),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (docIds.length === 0) return
    createMutation.mutate({ document_ids: docIds, num_questions_per_doc: numQuestions, retrieval_config: config })
  }

  const runs = runsPage?.items ?? []

  return (
    <div>
      <PageHeader
        eyebrow="Retrieval &amp; answer quality"
        title="Evaluation"
        description="Run the same corpus through different retrieval configs and compare hit rate, MRR, and answer faithfulness — measured, not assumed."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-1">
          <p className="mb-3 text-sm font-medium text-[var(--color-text)]">New eval run</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">Documents ({docIds.length})</p>
              <DocumentPicker
                documents={readyDocs}
                selected={docIds}
                onToggle={(id) => setDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">
                Questions per document
              </span>
              <input
                type="number"
                min={1}
                max={25}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-muted)]">Retrieval config</span>
              <select
                value={config}
                onChange={(e) => setConfig(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              >
                {RETRIEVAL_CONFIGS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={docIds.length === 0 || createMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40"
            >
              <ScanSearch className="h-3.5 w-3.5" />
              {createMutation.isPending ? 'Starting…' : 'Run evaluation'}
            </button>
          </form>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
              Config comparison — last {Math.min(runs.length, 10)} runs
            </p>
            {runs.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--color-text-faint)]">
                Run an evaluation to see metrics compared here.
              </p>
            ) : (
              <EvalRunChart runs={runs} />
            )}
          </Card>

          <Card className="p-0">
            {isLoading ? (
              <LoadingState label="Loading eval runs…" />
            ) : isError ? (
              <div className="p-6">
                <ErrorState message={apiErrorMessage(error, 'Could not load eval runs.')} retry={() => refetch()} />
              </div>
            ) : runs.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<ScanSearch className="h-7 w-7" />} title="No eval runs yet" description="Kick one off on the left to start measuring retrieval and answer quality." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
                      <th className="px-4 py-2 font-medium">Run</th>
                      <th className="px-4 py-2 font-medium">Config</th>
                      <th className="px-4 py-2 font-medium">Docs</th>
                      <th className="px-4 py-2 font-medium">Questions</th>
                      <th className="px-4 py-2 font-medium">Hit rate</th>
                      <th className="px-4 py-2 font-medium">MRR</th>
                      <th className="px-4 py-2 font-medium">Faithfulness</th>
                      <th className="px-4 py-2 font-medium">Avg latency</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs
                      .slice()
                      .sort((a, b) => b.id - a.id)
                      .map((run) => (
                        <tr key={run.id} className="border-t border-[var(--color-border-soft)]">
                          <td className="px-4 py-3">
                            <Link to={`/evaluation/${run.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                              #{run.id}
                            </Link>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{run.retrieval_config}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">{run.document_ids.length}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">{run.num_questions}</td>
                          <td className="px-4 py-3 font-mono font-medium text-[var(--color-text)]">{formatPercent(run.retrieval_hit_rate)}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">{formatMrr(run.retrieval_mrr)}</td>
                          <td className="px-4 py-3 font-mono font-medium text-[var(--color-text)]">{formatPercent(run.answer_faithfulness_rate)}</td>
                          <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">{formatMs(run.avg_latency_ms)}</td>
                          <td className="px-4 py-3">
                            <EvalRunStatusBadge status={run.status} hitRate={run.retrieval_hit_rate} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
