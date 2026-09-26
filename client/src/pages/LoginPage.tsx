import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/authContext'
import { Button, Card, ErrorMessage, Screen, TextField } from '../components/ui'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault() // stop the browser's default full-page form submit
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <h1 className="mb-6 text-center text-3xl font-bold text-slate-900">Shift Organizer</h1>
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Log in</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </Card>
    </Screen>
  )
}
