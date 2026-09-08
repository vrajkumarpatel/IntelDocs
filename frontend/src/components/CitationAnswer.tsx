import { FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { parseAnswerCitations, referencedCitations } from '../lib/citations'
import type { Citation } from '../types'

/**
 * Renders a cited answer with inline, clickable `[n]` markers that link back
 * to the source chunk/page. This is the core interaction of the Ask page —
 * every citation must be traceable to an actual retrieved chunk (per
 * SPEC.md's answer-generation contract), so the UI treats sources as
 * first-class, not a footnote afterthought.
 */
export function CitationAnswer({
  answer,
  citations,
  onOpenDocument,
}: {
  answer: string
  citations: Citation[]
  onOpenDocument?: (documentId: number, pageNumber: number) => void
}) {
  const [active, setActive] = useState<number | null>(null)
  const segments = useMemo(() => parseAnswerCitations(answer, citations), [answer, citations])
  const sources = useMemo(() => referencedCitations(segments), [segments])

  return (
    <div className="space-y-5">
      <p className="text-[15px] leading-relaxed text-[var(--color-text)]">
        {segments.map((seg, i) => {
          if (seg.type === 'text') return <span key={i}>{seg.content}</span>
          const isActive = active === seg.index
          return (
            <button
              key={i}
              type="button"
              data-testid={`citation-marker-${seg.index}`}
              onMouseEnter={() => setActive(seg.index)}
              onFocus={() => setActive(seg.index)}
              onClick={() => setActive(seg.index)}
              className={`citation-mark mx-0.5 inline-flex h-[1.05em] min-w-[1.3em] translate-y-[-1px] items-center justify-center rounded px-1 align-baseline transition-colors ${
                isActive
                  ? 'bg-[var(--color-cite)] text-white'
                  : 'bg-[var(--color-cite-soft)] text-[var(--color-cite-ink)] hover:bg-[var(--color-cite)] hover:text-white'
              }`}
              aria-label={`Source ${seg.index}, page ${seg.citation.page_number}`}
              aria-pressed={isActive}
            >
              {seg.index}
            </button>
          )
        })}
      </p>

      {sources.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)]">
          <p className="border-b border-[var(--color-border)] px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-faint)]">
            Sources
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {sources.map((citation, i) => {
              const num = i + 1
              const isActive = active === num
              return (
                <li key={`${citation.chunk_id}-${num}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(num)}
                    onClick={() => {
                      setActive(num)
                      onOpenDocument?.(citation.document_id, citation.page_number)
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isActive ? 'bg-[var(--color-cite-soft)]' : 'hover:bg-[var(--color-surface)]'
                    }`}
                  >
                    <span
                      className={`citation-mark mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                        isActive
                          ? 'bg-[var(--color-cite)] text-white'
                          : 'bg-[var(--color-cite-soft)] text-[var(--color-cite-ink)]'
                      }`}
                    >
                      {num}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-muted)]">
                        <FileText className="h-3 w-3" />
                        Document #{citation.document_id} &middot; page {citation.page_number}
                      </span>
                      <span className="mt-1 block truncate text-sm text-[var(--color-text)]">
                        &ldquo;{citation.snippet}&rdquo;
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
