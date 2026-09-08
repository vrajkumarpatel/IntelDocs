/** Formatting helpers for the evaluation dashboard and usage/admin views. */

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatMrr(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(3)
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(2)}s`
}

export function formatTokens(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value < 1000) return `${value}`
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}k`
  return `${(value / 1_000_000).toFixed(2)}M`
}

/** Estimated cost formatted as USD. Assumes value already in dollars. */
export function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (value === 0) return '$0.00'
  if (value < 0.01) return `<$0.01`
  return `$${value.toFixed(2)}`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Compares two eval runs on a given numeric metric and returns the signed
 * percentage-point delta (b - a), used to show "+4pts vs previous config".
 * Returns null when either value is missing.
 */
export function metricDeltaPct(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return (b - a) * 100
}
