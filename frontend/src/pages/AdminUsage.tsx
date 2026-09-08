import { useQuery } from '@tanstack/react-query'
import { CircleDollarSign, FileStack, Gauge, MessagesSquare, ShieldAlert } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../components/Card'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { apiErrorMessage, getAdminUsage } from '../lib/api'
import { formatCost, formatDateShort, formatTokens } from '../lib/format'

const COLOR_QUERIES = '#2a78d6'

export function AdminUsage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-usage'],
    queryFn: getAdminUsage,
  })

  if (isLoading) return <LoadingState label="Loading usage…" />

  if (isError) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-20 text-center">
          <ShieldAlert className="h-7 w-7 text-[var(--color-text-faint)]" />
          <p className="font-medium text-[var(--color-text)]">Admins only</p>
          <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
            Org-wide usage and cost data is restricted to admin accounts.
          </p>
        </div>
      )
    }
    return <ErrorState message={apiErrorMessage(error, 'Could not load usage data.')} retry={() => refetch()} />
  }

  if (!data) return null

  const chartData = data.by_day.map((d) => ({
    date: formatDateShort(d.date),
    queries: d.queries_run,
  }))

  return (
    <div>
      <PageHeader eyebrow="Org-wide" title="Admin / Usage" description="Documents processed, queries run, tokens consumed, and estimated cost across your organization." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={FileStack} label="Documents processed" value={data.documents_processed.toLocaleString()} />
        <StatTile icon={MessagesSquare} label="Queries run" value={data.queries_run.toLocaleString()} />
        <StatTile icon={Gauge} label="Total tokens" value={formatTokens(data.total_tokens)} />
        <StatTile icon={CircleDollarSign} label="Estimated cost" value={formatCost(data.estimated_cost_usd)} />
      </div>

      <Card className="p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
          Queries run by day
        </p>
        {chartData.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-text-faint)]">No activity recorded yet.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }} axisLine={{ stroke: 'var(--color-border)' }} tickLine={false} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'var(--color-paper)' }}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                  }}
                />
                <Bar dataKey="queries" name="Queries" fill={COLOR_QUERIES} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatTile({ icon: Icon, label, value }: { icon: typeof FileStack; label: string; value: string }) {
  return (
    <Card className="p-4">
      <Icon className="mb-2 h-4 w-4 text-[var(--color-text-faint)]" />
      <p className="mb-1 text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="font-mono text-xl font-semibold text-[var(--color-text)]">{value}</p>
    </Card>
  )
}
