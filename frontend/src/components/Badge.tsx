import type { BadgeStyle } from '../lib/badges'

export function Badge({ style }: { style: BadgeStyle }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {style.label}
    </span>
  )
}
