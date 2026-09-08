import { useQuery } from '@tanstack/react-query'
import { History, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Pagination } from '../components/Pagination'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { apiErrorMessage, listQueries } from '../lib/api'
import { formatDate, formatMs, formatTokens } from '../lib/format'

const PAGE_SIZE = 20

export function QueryHistory() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [configFilter, setConfigFilter] = useState<string>('all')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['queries', page],
    queryFn: () => listQueries(page, PAGE_SIZE),
  })

  const configs = useMemo(
    () => Array.from(new Set((data?.items ?? []).map((q) => q.retrieval_config))),
    [data],
  )

  const filtered = useMemo(() => {
    return (data?.items ?? []).filter((q) => {
      if (configFilter !== 'all' && q.retrieval_config !== configFilter) return false
      if (search.trim() && !q.question.toLowerCase().includes(search.trim().toLowerCase())) return false
      return true
    })
  }, [data, configFilter, search])

  return (
    <div>
      <PageHeader eyebrow="Audit trail" title="Query History" description="Every question asked against your documents, with its retrieval config and cost." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by question text…"
            className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <select
          value={configFilter}
          onChange={(e) => setConfigFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
        >
          <option value="all">All configs</option>
          {configs.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <Card className="p-0">
        {isLoading ? (
          <LoadingState label="Loading query history…" />
        ) : isError ? (
          <div className="p-6">
            <ErrorState message={apiErrorMessage(error, 'Could not load query history.')} retry={() => refetch()} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={<History className="h-7 w-7" />} title="No queries match" description="Try clearing filters, or ask a question on the Ask page." />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-soft)]">
            {filtered.map((q) => (
              <div key={q.id} className="p-4">
                <div className="mb-1.5 flex items-start justify-between gap-3">
                  <p className="font-medium text-[var(--color-text)]">{q.question}</p>
                  <span className="shrink-0 rounded-full bg-[var(--color-paper)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">
                    {q.retrieval_config}
                  </span>
                </div>
                <p className="mb-2 line-clamp-2 text-sm text-[var(--color-text-muted)]">{q.answer}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-[var(--color-text-faint)]">
                  <span>{q.citations.length} citation{q.citations.length === 1 ? '' : 's'}</span>
                  <span>{formatMs(q.latency_ms)}</span>
                  <span>{formatTokens(q.prompt_tokens + q.completion_tokens)} tokens</span>
                  <span>{q.model_used}</span>
                  <span>{formatDate(q.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {data && (
          <div className="px-4 pb-3 pt-1">
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  )
}
