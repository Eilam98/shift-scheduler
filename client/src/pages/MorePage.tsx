import { Link } from 'react-router'
import { useAuth } from '../auth/authContext'
import { navItems, PHONE_TABS } from '../components/navItems'
import { ChevronEndIcon } from '../components/icons'
import { Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'

/** /more — on phones, the menu items that don't fit in the bottom tab bar. */
export function MorePage() {
  const { user } = useAuth()
  const { t } = useI18n()
  if (!user) return null
  const rest = navItems(user).slice(PHONE_TABS - 1)

  return (
    <Screen title={t('nav.more')}>
      <div className="space-y-2">
        {rest.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 font-medium text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <item.icon className="size-6 text-slate-500" />
            <span className="flex-1">{t(item.label)}</span>
            <ChevronEndIcon className="size-5 text-slate-400" />
          </Link>
        ))}
      </div>
    </Screen>
  )
}
