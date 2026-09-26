import { Link } from 'react-router'
import { useAuth } from '../auth/authContext'
import { Card, Screen } from '../components/ui'
import { roleLabel } from '../lib/roles'

// Placeholder home screen until the schedule features exist.
export function HomePage() {
  const { user, logout } = useAuth()
  if (!user) return null

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
