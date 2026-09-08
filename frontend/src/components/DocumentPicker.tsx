import { Check, FileText } from 'lucide-react'
import type { DocumentRecord } from '../types'

export function DocumentPicker({
  documents,
  selected,
  onToggle,
  disabledIds,
  emptyLabel = 'No documents available.',
}: {
  documents: DocumentRecord[]
  selected: number[]
  onToggle: (id: number) => void
  disabledIds?: number[]
  emptyLabel?: string
}) {
  if (documents.length === 0) {
    return <p className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
  }

  return (
    <ul className="max-h-72 space-y-1 overflow-y-auto scrollbar-thin rounded-md border border-[var(--color-border)] p-1.5">
      {documents.map((doc) => {
        const isSelected = selected.includes(doc.id)
        const isDisabled = disabledIds?.includes(doc.id) && !isSelected
        return (
          <li key={doc.id}>
            <button
              type="button"
              disabled={isDisabled}
              onClick={() => onToggle(doc.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary-hover)]'
                  : 'text-[var(--color-text)] hover:bg-[var(--color-paper)]'
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border)]'
                }`}
              >
                {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-faint)]" />
              <span className="min-w-0 flex-1 truncate">{doc.filename}</span>
              <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-faint)]">v{doc.version}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
