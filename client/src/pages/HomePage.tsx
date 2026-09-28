import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ChevronEndIcon } from '../components/icons'
import { MyShiftRow } from '../components/MyShiftRow'
import { Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { roleLabel } from '../lib/roles'
import { useMyShifts } from '../lib/useMyShifts'
import type { Department } from '../types'

// Home: who you are, your next shifts, and shortcuts to the schedules you can edit.
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
  // otherwise the departments they manage.
  const editable: Department[] = user.isRestaurantManager
    ? allDepartments
    : user.managedDepartments.map((d) => ({ id: d.departmentId, name: d.departmentName }))

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
          {user.managedDepartments.length > 0 && (
            <p className="mt-1 text-sm text-slate-700">
              {t('department.manages')}:{' '}
              {user.managedDepartments.map((m) => departmentName(m.departmentName)).join(', ')}
            </p>
          )}
        </Card>

        {user.memberships.length > 0 && <NextShiftsCard />}

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

const NEXT_SHIFTS = 3

/** The next few of my shifts (posted weeks), with a link to My shifts. */
function NextShiftsCard() {
  const { t } = useI18n()
  const state = useMyShifts()

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-semibold text-slate-900">{t('home.nextShifts')}</p>
        <Link to="/my-shifts" className="text-sm font-medium text-indigo-600">
          {t('home.allShifts')}
        </Link>
      </div>
      {state.status === 'loading' && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {state.status === 'error' && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.status === 'ready' &&
        (state.upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">{t('myShifts.noUpcoming')}</p>
        ) : (
          <div className="space-y-2">
            {state.upcoming.slice(0, NEXT_SHIFTS).map((shift) => (
              <MyShiftRow key={shift.slotId} shift={shift} />
            ))}
          </div>
        ))}
    </Card>
  )
}
