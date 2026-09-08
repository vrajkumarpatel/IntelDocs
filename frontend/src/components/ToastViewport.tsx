import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useToast } from '../context/ToastContext'

const ICON = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
}

const STYLE = {
  success: 'border-[var(--color-status-ready)]/30 text-[var(--color-status-ready)]',
  error: 'border-[var(--color-status-failed)]/30 text-[var(--color-status-failed)]',
  info: 'border-[var(--color-primary)]/30 text-[var(--color-primary)]',
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICON[toast.kind]
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-start gap-2 rounded-lg border bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-[var(--shadow-pop)] ${STYLE[toast.kind]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-[var(--color-text)]">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
