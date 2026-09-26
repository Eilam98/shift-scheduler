import { useAuth } from './auth/authContext'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <p className="p-10 text-center text-slate-500">Loading…</p>
  }
  if (!user) return <LoginPage />
  if (user.requiresPasswordChange) return <ChangePasswordPage />
  return <HomePage />
}

export default App
