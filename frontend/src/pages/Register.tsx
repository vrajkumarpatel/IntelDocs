import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiErrorMessage } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { AuthLayout, Field } from './Login'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({ org_name: orgName, email, password })
      navigate('/documents', { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create your organization.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-semibold text-[var(--color-text)]">Create your organization</h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        You'll be the first admin — invite teammates once you're in.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Field label="Organization name" type="text" value={orgName} onChange={setOrgName} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
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
          {submitting ? 'Creating…' : 'Create organization'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-[var(--color-primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
