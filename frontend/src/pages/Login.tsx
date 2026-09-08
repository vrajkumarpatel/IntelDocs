import { FileText } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/documents'
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not sign in with those credentials.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-[var(--color-text)]">Sign in</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Access your organization's document workspace.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        {error && (
          <p role="alert" className="rounded-md bg-[var(--color-status-failed-soft)] px-3 py-2 text-sm text-[var(--color-status-failed)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--color-primary)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        New organization?{' '}
        <Link to="/register" className="font-medium text-[var(--color-primary)] hover:underline">
          Register
        </Link>
      </p>
    </AuthLayout>
  )
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-ink)] text-[var(--color-cite)]">
            <FileText className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-[var(--color-text)]">
            IntelDocs
          </span>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)]"
      />
    </label>
  )
}
