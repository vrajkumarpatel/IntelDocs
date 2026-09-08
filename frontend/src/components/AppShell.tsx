import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  FileStack,
  History,
  LogOut,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  SplitSquareHorizontal,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/documents', label: 'Documents', icon: FileStack, end: false },
  { to: '/ask', label: 'Ask', icon: MessagesSquare, end: false },
  { to: '/history', label: 'Query History', icon: History, end: false },
  { to: '/compare', label: 'Compare', icon: SplitSquareHorizontal, end: false },
  { to: '/evaluation', label: 'Evaluation', icon: ScanSearch, end: false },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { logout, role } = useAuth()

  return (
    <div className="flex min-h-screen bg-[var(--color-paper)]">
      <aside className="flex w-60 shrink-0 flex-col bg-[var(--color-ink)] text-[var(--color-text-on-ink)]">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-cite)] font-display text-sm font-bold text-[var(--color-ink)]">
            i
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight text-white">
            IntelDocs
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--color-ink-soft)] text-white'
                    : 'text-[var(--color-text-on-ink-muted)] hover:bg-[var(--color-ink-soft)] hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </NavLink>
          ))}

          {role !== 'member' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `mt-2 flex items-center gap-2.5 rounded-md border-t border-[var(--color-ink-line)] px-3 pt-3 pb-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-[var(--color-text-on-ink-muted)] hover:text-white'
                }`
              }
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              Admin / Usage
            </NavLink>
          )}
        </nav>

        <div className="border-t border-[var(--color-ink-line)] px-3 py-3">
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-text-on-ink-muted)] transition-colors hover:bg-[var(--color-ink-soft)] hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-end border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6">
          <div className="flex items-center gap-2 font-mono text-xs text-[var(--color-text-faint)]">
            hybrid retrieval &middot; local embeddings &middot; Groq inference
          </div>
        </header>
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  )
}
