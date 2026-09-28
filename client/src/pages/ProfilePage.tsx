import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ChevronEndIcon } from '../components/icons'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { roleLabel } from '../lib/roles'
import type { Language } from '../types'

/** /profile — my details, language, change password, log out. */
export function ProfilePage() {
  const { user, logout, saveLanguage } = useAuth()
  const { t, errorMessage, departmentName, restaurantLanguage } = useI18n()
  const location = useLocation()
  const passwordChanged = (location.state as { passwordChanged?: boolean } | null)?.passwordChanged
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!user) return null

  async function changeLanguage(value: string) {
    setError(null)
    setSaving(true)
    try {
      await saveLanguage(value === '' ? null : (value as Language))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen title={t('profile.title')}>
      <div className="space-y-4">
        {passwordChanged && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {t('password.changed')}
          </p>
        )}

        <Card>
          <p className="text-lg font-semibold text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-500" dir="ltr">
            {user.email}
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-indigo-700 uppercase">
            {t(roleLabel(user))}
          </p>
          {user.memberships.length > 0 && (
            <p className="mt-3 text-sm text-slate-700">
              {t('department.worksIn')}:{' '}
              {user.memberships.map((m) => departmentName(m.departmentName)).join(', ')}
            </p>
          )}
          {user.managedDepartment && (
            <p className="mt-1 text-sm text-slate-700">
              {t('department.manages')}: {departmentName(user.managedDepartment.departmentName)}
            </p>
          )}
        </Card>

        <Card>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('profile.language')}</span>
            <select
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900"
              value={user.language ?? ''}
              disabled={saving}
              onChange={(e) => changeLanguage(e.target.value)}
            >
              <option value="">
                {t('profile.languageDefault', { language: t(`language.${restaurantLanguage}`) })}
              </option>
              <option value="HE">{t('language.HE')}</option>
              <option value="EN">{t('language.EN')}</option>
            </select>
          </label>
          {error && (
            <div className="mt-3">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
        </Card>

        <Link
          to="/profile/password"
          className="flex items-center justify-between rounded-2xl bg-white p-6 font-medium text-slate-900 shadow-sm hover:bg-slate-50"
        >
          {t('password.changeTitle')}
          <ChevronEndIcon className="size-5 text-slate-400" />
        </Link>

        <Button variant="secondary" onClick={logout}>
          {t('common.logout')}
        </Button>
      </div>
    </Screen>
  )
}
