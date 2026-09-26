import { useAuth } from '../auth/authContext'
import { Card, Screen } from '../components/ui'

// Placeholder home screen until the schedule features exist.
export function HomePage() {
  const { user, logout } = useAuth()
  if (!user) return null

  const role = user.isRestaurantManager
    ? 'Restaurant manager'
    : user.departments.some((d) => d.isManager)
      ? 'Department manager'
      : 'Worker'

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
        <p className="mt-1 text-sm text-slate-500">{role}</p>
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
    </Screen>
  )
}
