import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/authContext'
import { Button, Card, ErrorMessage, Screen, TextField } from '../components/ui'
import { PASSWORD_HINT, PASSWORD_RULE } from '../lib/password'

/** Shown instead of the app while user.requiresPasswordChange is true. */
export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!PASSWORD_RULE.test(newPassword)) return setError(PASSWORD_HINT)
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.')
    if (newPassword === currentPassword) {
      return setError('Choose a password different from your temporary one.')
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Hi {user?.name}. You're using a temporary password — set your own to continue.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Temporary password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            hint={PASSWORD_HINT}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
        <button onClick={logout} className="mt-4 w-full text-sm text-slate-500 hover:text-slate-700">
          Log out
        </button>
      </Card>
    </Screen>
  )
}
