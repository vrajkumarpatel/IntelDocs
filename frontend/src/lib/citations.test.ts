import { describe, expect, it } from 'vitest'
import { parseAnswerCitations, referencedCitations } from './citations'
import type { Citation } from '../types'

const citations: Citation[] = [
  { chunk_id: 101, document_id: 1, page_number: 3, snippet: 'Termination requires 30 days notice.' },
  { chunk_id: 102, document_id: 1, page_number: 7, snippet: 'Late fees accrue at 1.5% monthly.' },
]

describe('parseAnswerCitations', () => {
  it('splits text around inline [n] markers and attaches the matching citation', () => {
    const answer = 'Notice is 30 days [1]. Late fees are 1.5% [2].'
    const segments = parseAnswerCitations(answer, citations)

    expect(segments).toEqual([
      { type: 'text', content: 'Notice is 30 days ' },
      { type: 'citation', index: 1, marker: '[1]', citation: citations[0] },
      { type: 'text', content: '. Late fees are 1.5% ' },
      { type: 'citation', index: 2, marker: '[2]', citation: citations[1] },
      { type: 'text', content: '.' },
    ])
  })

  it('renders an out-of-range marker as plain text instead of a dead link', () => {
    const answer = 'Something odd [9].'
    const segments = parseAnswerCitations(answer, citations)

    expect(segments).toEqual([
      { type: 'text', content: 'Something odd ' },
      { type: 'text', content: '[9]' },
      { type: 'text', content: '.' },
    ])
  })

  it('handles an answer with no citation markers at all', () => {
    const segments = parseAnswerCitations('No sources needed here.', citations)
    expect(segments).toEqual([{ type: 'text', content: 'No sources needed here.' }])
  })

  it('handles a repeated marker referencing the same citation twice', () => {
    const answer = '[1] and again [1].'
    const segments = parseAnswerCitations(answer, citations)
    expect(segments.filter((s) => s.type === 'citation')).toHaveLength(2)
  })

  it('returns an empty array for an empty answer', () => {
    expect(parseAnswerCitations('', citations)).toEqual([])
  })
})

describe('referencedCitations', () => {
  it('de-duplicates repeated markers, preserving first-appearance order', () => {
    const segments = parseAnswerCitations('[2] then [1] then [2] again.', citations)
    const refs = referencedCitations(segments)
    expect(refs).toEqual([citations[1], citations[0]])
  })

  it('returns an empty list when no markers were referenced', () => {
    const segments = parseAnswerCitations('Plain answer.', citations)
    expect(referencedCitations(segments)).toEqual([])
  })
})
