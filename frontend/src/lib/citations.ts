import type { Citation } from '../types'

/**
 * Answers come back from POST /api/v1/query as
 * `{answer, citations: [{chunk_id, page_number, snippet}], confidence}`
 * (see SPEC.md's Answer generation contract). The answer prose is expected
 * to reference sources with inline `[n]` markers, 1-indexed into the
 * `citations` array in order — the same convention the LLM is prompted to
 * produce. This module turns that marker text into renderable segments so
 * each marker can become a clickable reference back to its source chunk.
 */

export type AnswerSegment =
  | { type: 'text'; content: string }
  | { type: 'citation'; index: number; marker: string; citation: Citation }

const MARKER_RE = /\[(\d+)\]/g

export function parseAnswerCitations(answer: string, citations: Citation[]): AnswerSegment[] {
  if (!answer) return []

  const segments: AnswerSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  MARKER_RE.lastIndex = 0
  while ((match = MARKER_RE.exec(answer)) !== null) {
    const [marker, numStr] = match
    const oneBasedIndex = Number.parseInt(numStr, 10)
    const citation = citations[oneBasedIndex - 1]

    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: answer.slice(lastIndex, match.index) })
    }

    if (citation) {
      segments.push({ type: 'citation', index: oneBasedIndex, marker, citation })
    } else {
      // Marker doesn't map to a real citation (out of range) — render as
      // plain text rather than a dead/misleading link.
      segments.push({ type: 'text', content: marker })
    }

    lastIndex = match.index + marker.length
  }

  if (lastIndex < answer.length) {
    segments.push({ type: 'text', content: answer.slice(lastIndex) })
  }

  return segments
}

/** Citations actually referenced by the answer text, in first-appearance order. */
export function referencedCitations(segments: AnswerSegment[]): Citation[] {
  const seen = new Set<number>()
  const result: Citation[] = []
  for (const seg of segments) {
    if (seg.type === 'citation' && !seen.has(seg.index)) {
      seen.add(seg.index)
      result.push(seg.citation)
    }
  }
  return result
}
