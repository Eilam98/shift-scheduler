import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from './auth/authContext'
import { AppShell } from './components/AppShell'
import { useI18n } from './i18n/i18nContext'
import { ChangePasswordPage, ForcedPasswordChangePage } from './pages/ChangePasswordPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MyShiftsPage } from './pages/MyShiftsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { ProfilePage } from './pages/ProfilePage'
import { SchedulePage } from './pages/SchedulePage'
import { WorkersPage } from './pages/WorkersPage'

function App() {
  const { user, loading } = useAuth()
  const { t } = useI18n()

  if (loading) {
    return <p className="p-10 text-center text-slate-500">{t('common.loading')}</p>
  }
  if (!user) return <LoginPage />
  if (user.requiresPasswordChange) return <ForcedPasswordChangePage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/workers"
          element={user.isRestaurantManager ? <WorkersPage /> : <Navigate to="/" replace />}
        />
        <Route path="/schedule/:departmentId?" element={<SchedulePage />} />
        <Route path="/my-shifts" element={<MyShiftsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/password" element={<ChangePasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
