import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/authContext'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SchedulePage } from './pages/SchedulePage'
import { WorkersPage } from './pages/WorkersPage'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="p-10 text-center text-slate-500">Loading…</p>
  }
  if (!user) return <LoginPage />
  if (user.requiresPasswordChange) return <ChangePasswordPage />

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/workers"
        element={user.isRestaurantManager ? <WorkersPage /> : <Navigate to="/" replace />}
      />
      <Route path="/schedule/:departmentId" element={<SchedulePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
