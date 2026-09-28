import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/authContext'
import { Button, Card, CenteredScreen, ErrorMessage, Screen, TextField } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { PASSWORD_RULE } from '../lib/password'

/** Shown instead of the app while user.requiresPasswordChange is true. */
export function ForcedPasswordChangePage() {
  const { user, logout } = useAuth()
  const { t } = useI18n()

  return (
    <CenteredScreen>
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">{t('password.forcedTitle')}</h1>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          {t('password.forcedIntro', { name: user?.name ?? '' })}
        </p>
        <ChangePasswordForm forced />
        <button onClick={logout} className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700">
          {t('common.logout')}
        </button>
      </Card>
    </CenteredScreen>
  )
}

/** /profile/password — change your password any time. */
export function ChangePasswordPage() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <Screen title={t('password.changeTitle')}>
      <Card>
        <ChangePasswordForm onDone={() => navigate('/profile', { state: { passwordChanged: true } })} />
        <Link to="/profile" className="mt-4 block text-center text-sm text-slate-500 hover:text-slate-700">
          {t('common.cancel')}
        </Link>
      </Card>
    </Screen>
  )
}

function ChangePasswordForm({ forced = false, onDone }: { forced?: boolean; onDone?: () => void }) {
  const { changePassword } = useAuth()
  const { t, errorMessage } = useI18n()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!PASSWORD_RULE.test(newPassword)) return setError(t('password.hint'))
    if (newPassword !== confirmPassword) return setError(t('password.mismatch'))
    if (newPassword === currentPassword) return setError(t('password.sameAsCurrent'))

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      onDone?.()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextField
        label={forced ? t('password.temporary') : t('password.current')}
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <TextField
        label={t('password.new')}
        type="password"
        autoComplete="new-password"
        hint={t('password.hint')}
        required
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <TextField
        label={t('password.confirm')}
        type="password"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      {error && <ErrorMessage>{error}</ErrorMessage>}
      <Button type="submit" disabled={submitting}>
        {submitting ? t('common.saving') : t('password.save')}
      </Button>
    </form>
  )
}
