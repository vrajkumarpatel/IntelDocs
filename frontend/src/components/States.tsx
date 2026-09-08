import { FileWarning, Inbox, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-muted)]">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center">
      <div className="text-[var(--color-text-faint)]">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <div>
        <p className="font-medium text-[var(--color-text)]">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-status-failed)]/25 bg-[var(--color-status-failed-soft)]/40 py-16 text-center">
      <FileWarning className="h-7 w-7 text-[var(--color-status-failed)]" />
      <div>
        <p className="font-medium text-[var(--color-text)]">Something went wrong</p>
        <p className="mt-1 max-w-sm text-sm text-[var(--color-text-muted)]">{message}</p>
      </div>
      {retry && (
        <button
          type="button"
          onClick={retry}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-paper)]"
        >
          Try again
        </button>
      )}
    </div>
  )
}
