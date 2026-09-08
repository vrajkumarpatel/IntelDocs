import { describe, expect, it } from 'vitest'
import { documentStatusBadge, evalRunStatusBadge, riskBadge, verdictBadge } from './badges'

describe('documentStatusBadge', () => {
  it('labels each document status distinctly and only pulses while processing', () => {
    expect(documentStatusBadge('processing').label).toBe('Processing')
    expect(documentStatusBadge('processing').pulse).toBe(true)
    expect(documentStatusBadge('ready').pulse).toBeFalsy()
    expect(documentStatusBadge('failed').pulse).toBeFalsy()

    const classes = new Set([
      documentStatusBadge('processing').className,
      documentStatusBadge('ready').className,
      documentStatusBadge('failed').className,
    ])
    expect(classes.size).toBe(3)
  })
})

describe('evalRunStatusBadge', () => {
  it('treats a run with no hit rate yet as running, matching the async-run contract', () => {
    expect(evalRunStatusBadge(undefined, null).label).toBe('Running')
    expect(evalRunStatusBadge(undefined, 0).label).toBe('Complete') // 0 is a valid, non-null hit rate
    expect(evalRunStatusBadge(undefined, 0.8).label).toBe('Complete')
  })

  it('prefers an explicit status over inferring from hit rate', () => {
    expect(evalRunStatusBadge('failed', 0.8).label).toBe('Failed')
    expect(evalRunStatusBadge('running', 0.8).label).toBe('Running')
  })
})

describe('riskBadge', () => {
  it('gives each risk level a distinct label and color', () => {
    const levels = ['low', 'medium', 'high'] as const
    const labels = levels.map((l) => riskBadge(l).label)
    const classes = levels.map((l) => riskBadge(l).className)
    expect(new Set(labels).size).toBe(3)
    expect(new Set(classes).size).toBe(3)
  })
})

describe('verdictBadge', () => {
  it('gives each faithfulness verdict a distinct label and color', () => {
    const verdicts = ['faithful', 'partial', 'unfaithful'] as const
    const labels = verdicts.map((v) => verdictBadge(v).label)
    const classes = verdicts.map((v) => verdictBadge(v).className)
    expect(new Set(labels).size).toBe(3)
    expect(new Set(classes).size).toBe(3)
  })
})
