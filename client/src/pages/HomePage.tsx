import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ChevronEndIcon } from '../components/icons'
import { Card, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { roleLabel } from '../lib/roles'
import type { Department } from '../types'

// Home: who you are, plus shortcuts to the schedules you can edit.
export function HomePage() {
  const { user } = useAuth()
  const { t, departmentName } = useI18n()
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const isRestaurantManager = !!user?.isRestaurantManager

  useEffect(() => {
    if (!isRestaurantManager) return
    let cancelled = false
    api<{ departments: Department[] }>('/departments')
      .then(({ departments }) => {
        if (!cancelled) setAllDepartments(departments)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isRestaurantManager])

  if (!user) return null

  // Schedules this user can edit: every department for the restaurant manager,
  // otherwise the one department they manage.
  const editable: Department[] = user.isRestaurantManager
    ? allDepartments
    : user.managedDepartment
      ? [{ id: user.managedDepartment.departmentId, name: user.managedDepartment.departmentName }]
      : []

  return (
    <Screen title={t('app.name')}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="text-lg text-slate-900">{t('home.welcome', { name: user.name })}</p>
          <p className="mt-1 text-sm text-slate-500">{t(roleLabel(user))}</p>
          {user.memberships.length > 0 && (
            <p className="mt-4 text-sm text-slate-700">
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

        {editable.length > 0 && (
          <Card>
            <p className="font-semibold text-slate-900">{t('home.editSchedules')}</p>
            <div className="mt-3 space-y-2">
              {editable.map((d) => (
                <Link
                  key={d.id}
                  to={`/schedule/${d.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-slate-900 hover:bg-slate-50"
                >
                  {departmentName(d.name)}
                  <ChevronEndIcon className="size-5 text-slate-400" />
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </Screen>
  )
}
