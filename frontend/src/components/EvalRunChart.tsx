import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EvalRun } from '../types'

// Categorical hues: first three slots of the validated dataviz palette
// (blue/orange/aqua clear every adjacent + all-pairs CVD gate in light mode).
const COLOR_HIT_RATE = '#2a78d6'
const COLOR_MRR = '#eb6834'
const COLOR_FAITHFULNESS = '#1baf7a'

interface ChartRow {
  label: string
  fullLabel: string
  hitRate: number | null
  mrr: number | null
  faithfulness: number | null
}

function toChartRow(run: EvalRun): ChartRow {
  return {
    label: `#${run.id}`,
    fullLabel: `Run #${run.id} · ${run.retrieval_config}`,
    hitRate: run.retrieval_hit_rate,
    mrr: run.retrieval_mrr,
    faithfulness: run.answer_faithfulness_rate,
  }
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      <p className="mb-1.5 font-mono font-medium text-[var(--color-text)]">{row.fullLabel}</p>
      <p style={{ color: COLOR_HIT_RATE }}>Hit rate: {row.hitRate !== null ? `${Math.round(row.hitRate * 100)}%` : '—'}</p>
      <p style={{ color: COLOR_MRR }}>MRR: {row.mrr !== null ? row.mrr.toFixed(3) : '—'}</p>
      <p style={{ color: COLOR_FAITHFULNESS }}>
        Faithfulness: {row.faithfulness !== null ? `${Math.round(row.faithfulness * 100)}%` : '—'}
      </p>
    </div>
  )
}

/**
 * Grouped bar comparison across eval runs — the comparative angle SPEC.md
 * calls out as the point of the eval pipeline (same corpus, different
 * retrieval configs, see which one actually performs better). All three
 * metrics share a 0-1 domain so one shared axis is honest; the tooltip
 * disambiguates rate (%) from reciprocal rank (decimal).
 */
export function EvalRunChart({ runs }: { runs: EvalRun[] }) {
  const data = runs
    .slice()
    .sort((a, b) => a.id - b.id)
    .slice(-10)
    .map(toChartRow)

  if (data.length === 0) return null

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="24%" barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 11, fill: 'var(--color-text-faint)' }}
            axisLine={false}
            tickLine={false}
            width={40}
            label={{
              value: 'Score (0–1)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 11, fill: 'var(--color-text-faint)' },
            }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-paper)' }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--color-text-muted)', paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar dataKey="hitRate" name="Hit rate" fill={COLOR_HIT_RATE} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar dataKey="mrr" name="MRR" fill={COLOR_MRR} radius={[4, 4, 0, 0]} maxBarSize={24} />
          <Bar
            dataKey="faithfulness"
            name="Faithfulness"
            fill={COLOR_FAITHFULNESS}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
