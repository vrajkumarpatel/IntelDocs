import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-1 font-mono text-xs uppercase tracking-wider text-[var(--color-text-faint)]">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
