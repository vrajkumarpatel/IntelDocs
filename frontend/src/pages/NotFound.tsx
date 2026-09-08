import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--color-paper)] text-center">
      <FileQuestion className="h-8 w-8 text-[var(--color-text-faint)]" />
      <p className="font-display text-xl font-semibold text-[var(--color-text)]">Page not found</p>
      <Link to="/documents" className="text-sm font-medium text-[var(--color-primary)] hover:underline">
        Back to Documents
      </Link>
    </div>
  )
}
