import { Link } from 'react-router'
import { useI18n } from '../i18n/i18nContext'
import { useNotifications } from '../notifications/notificationsContext'
import { BellIcon } from './icons'

/** Bell with the unread count; opens /notifications. */
export function NotificationBell() {
  const { unread } = useNotifications()
  const { t } = useI18n()
  const label = unread > 0 ? t('notifications.unreadLabel', { count: unread }) : t('notifications.title')

  return (
    <Link
      to="/notifications"
      aria-label={label}
      title={label}
      className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
    >
      <BellIcon className="size-6" />
      {unread > 0 && (
        <span className="absolute end-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs leading-5 font-semibold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}
