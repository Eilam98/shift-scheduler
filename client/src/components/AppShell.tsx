import type { ComponentType, SVGProps } from 'react'
import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/authContext'
import { useI18n } from '../i18n/i18nContext'
import type { MessageKey } from '../i18n/messages'
import { roleLabel } from '../lib/roles'
import type { User } from '../types'
import { CalendarIcon, HomeIcon, UserIcon, UsersIcon } from './icons'

interface NavItem {
  to: string
  label: MessageKey
  icon: ComponentType<SVGProps<SVGSVGElement>>
  end?: boolean // "/" must only be active on exactly "/"
}

/** The screens this user can reach — the same list drives both menus. */
function navItems(user: User): NavItem[] {
  const isManager = user.isRestaurantManager || !!user.managedDepartment
  return [
    { to: '/', label: 'nav.home', icon: HomeIcon, end: true },
    ...(isManager ? [{ to: '/schedule', label: 'nav.schedules', icon: CalendarIcon } as const] : []),
    ...(user.isRestaurantManager ? [{ to: '/workers', label: 'nav.workers', icon: UsersIcon } as const] : []),
    { to: '/profile', label: 'nav.profile', icon: UserIcon },
  ]
}

/**
 * Layout for every logged-in page. Phone: content + a bottom tab bar.
 * Desktop (md+): a side menu on the start side (right in Hebrew) + content.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  if (!user) return null
  const items = navItems(user)

  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e border-slate-200 bg-white md:flex">
        <p className="px-6 pt-6 pb-4 text-lg font-bold text-slate-900">{t('app.name')}</p>
        <nav aria-label={t('nav.main')} className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="size-5" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate font-medium text-slate-900">{user.name}</p>
          <p className="text-sm text-slate-500">{t(roleLabel(user))}</p>
          <button onClick={logout} className="mt-2 text-sm font-medium text-indigo-600">
            {t('common.logout')}
          </button>
        </div>
      </aside>

      {/* pb leaves room for the fixed tab bar on phones */}
      <main className="min-w-0 flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Outlet />
      </main>

      <nav
        aria-label={t('nav.main')}
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? 'text-indigo-600' : 'text-slate-500'
              }`
            }
          >
            <item.icon className="size-6" />
            {t(item.label)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
