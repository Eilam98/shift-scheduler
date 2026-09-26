import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/authContext'
import { Card, Screen } from '../components/ui'
import { api } from '../lib/api'
import { roleLabel } from '../lib/roles'
import type { Department } from '../types'

// Home: who you are, plus links to the screens your role can use.
export function HomePage() {
  const { user, logout } = useAuth()
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
    : user.departments
        .filter((d) => d.isManager)
        .map((d) => ({ id: d.departmentId, name: d.departmentName }))

  return (
    <Screen>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Shift Organizer</h1>
        <button onClick={logout} className="text-sm font-medium text-indigo-600">
          Log out
        </button>
      </div>
      <Card>
        <p className="text-lg text-slate-900">Welcome, {user.name}</p>
        <p className="mt-1 text-sm text-slate-500">{roleLabel(user)}</p>
        {user.departments.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            {user.departments.map((d) => (
              <li key={d.departmentId}>
                {d.departmentName}
                {d.isManager && ' (manager)'}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editable.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-slate-900">Edit schedules</p>
          <div className="mt-3 space-y-2">
            {editable.map((d) => (
              <Link
                key={d.id}
                to={`/schedule/${d.id}`}
                className="block rounded-lg border border-slate-200 px-4 py-3 text-slate-900 hover:bg-slate-50"
              >
                {d.name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {user.isRestaurantManager && (
        <Link
          to="/workers"
          className="mt-4 block rounded-2xl bg-white p-6 shadow-sm hover:bg-slate-50"
        >
          <p className="font-semibold text-slate-900">Manage workers →</p>
          <p className="mt-1 text-sm text-slate-500">Add workers and assign their departments</p>
        </Link>
      )}
    </Screen>
  )
}
