import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/authContext'
import { Button, Card, CenteredScreen, ErrorMessage, TextField } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
export function LoginPage() {
  const { login } = useAuth()
  const { t, errorMessage } = useI18n()
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
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CenteredScreen>
      <h1 className="mb-6 text-center text-3xl font-bold text-slate-900">{t('app.name')}</h1>
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">{t('login.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label={t('common.email')}
            type="email"
            autoComplete="username"
            inputMode="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label={t('password.label')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </Card>
    </CenteredScreen>
  )
}
