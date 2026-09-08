import { describe, expect, it } from 'vitest'
import { formatCost, formatMrr, formatMs, formatPercent, formatTokens, metricDeltaPct } from './format'

describe('formatPercent', () => {
  it('formats a 0-1 rate as a whole-number percentage by default', () => {
    expect(formatPercent(0.873)).toBe('87%')
    expect(formatPercent(1)).toBe('100%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('supports extra digits for precision-sensitive contexts', () => {
    expect(formatPercent(0.8734, 1)).toBe('87.3%')
  })

  it('renders a placeholder for missing eval metrics (run still in progress)', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
  })
})

describe('formatMrr', () => {
  it('formats to three decimal places', () => {
    expect(formatMrr(0.5)).toBe('0.500')
    expect(formatMrr(1)).toBe('1.000')
  })

  it('renders a placeholder when MRR has not been computed yet', () => {
    expect(formatMrr(null)).toBe('—')
  })
})

describe('formatMs', () => {
  it('shows milliseconds under one second, seconds above it', () => {
    expect(formatMs(420)).toBe('420ms')
    expect(formatMs(999)).toBe('999ms')
    expect(formatMs(1000)).toBe('1.00s')
    expect(formatMs(2500)).toBe('2.50s')
  })
})

describe('formatTokens', () => {
  it('compacts large token counts', () => {
    expect(formatTokens(240)).toBe('240')
    expect(formatTokens(1500)).toBe('1.5k')
    expect(formatTokens(2_500_000)).toBe('2.50M')
  })
})

describe('formatCost', () => {
  it('formats zero and sub-cent costs distinctly from real dollar amounts', () => {
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.004)).toBe('<$0.01')
    expect(formatCost(1.239)).toBe('$1.24')
  })
})

describe('metricDeltaPct', () => {
  it('returns the signed percentage-point delta between two runs', () => {
    expect(metricDeltaPct(0.6, 0.75)).toBeCloseTo(15)
    expect(metricDeltaPct(0.75, 0.6)).toBeCloseTo(-15)
  })

  it('returns null when a run has no metric yet, instead of a misleading number', () => {
    expect(metricDeltaPct(null, 0.5)).toBeNull()
    expect(metricDeltaPct(0.5, undefined)).toBeNull()
  })
})
