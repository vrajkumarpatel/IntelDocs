import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-1 pt-3">
      <p className="font-mono text-xs text-[var(--color-text-faint)]">
        Page {page} of {totalPages} &middot; {total} total
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-40 hover:enabled:bg-[var(--color-paper)]"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] disabled:opacity-40 hover:enabled:bg-[var(--color-paper)]"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
