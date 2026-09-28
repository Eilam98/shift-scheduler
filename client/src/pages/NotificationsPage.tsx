import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { formatDay, formatWeekRange } from '../lib/dates'
import { useNotifications } from '../notifications/notificationsContext'
import type { AppNotification } from '../types'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; notifications: AppNotification[] }

/**
 * /notifications — my latest notifications. Opening the page marks them all
 * read (the list still highlights the ones that were new on arrival).
 */
export function NotificationsPage() {
  const { t, errorMessage } = useI18n()
  const { refresh } = useNotifications()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { notifications, unreadCount } = await api<{
          notifications: AppNotification[]
          unreadCount: number
        }>('/notifications')
        if (cancelled) return
        setState({ status: 'ready', notifications })
        if (unreadCount > 0) {
          await api('/notifications/read', { method: 'POST' })
          refresh()
        }
      } catch (err) {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [errorMessage, refresh])

  return (
    <Screen title={t('notifications.title')}>
      {state.status === 'loading' && <p className="text-slate-500">{t('common.loading')}</p>}
      {state.status === 'error' && <ErrorMessage>{state.message}</ErrorMessage>}
      {state.status === 'ready' &&
        (state.notifications.length === 0 ? (
          <Card>
            <p className="text-slate-500">{t('notifications.empty')}</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {state.notifications.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} />
              </li>
            ))}
          </ul>
        ))}
    </Screen>
  )
}

function NotificationItem({ notification: n }: { notification: AppNotification }) {
  const { t, locale, departmentName } = useI18n()
  const department = departmentName(n.department.name)

  const text =
    n.type === 'SCHEDULE_POSTED' || !n.shift
      ? t('notification.SCHEDULE_POSTED', { department, week: formatWeekRange(n.weekStartDate, locale) })
      : t(`notification.${n.type}`, {
          department,
          shift: t(`shift.${n.shift.label}`),
          day: formatDay(n.shift.date, locale),
        })

  const when = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(n.createdAt)
  )

  return (
    <Link
      to={`/schedule/${n.department.id}?week=${n.weekStartDate}`}
      className={`flex gap-3 rounded-2xl p-4 shadow-sm hover:bg-slate-50 ${
        n.read ? 'bg-white' : 'bg-indigo-50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-indigo-600'}`}
      />
      <div className="min-w-0">
        <p className={`text-slate-900 ${n.read ? '' : 'font-semibold'}`}>{text}</p>
        <p className="mt-1 text-xs text-slate-500">{when}</p>
      </div>
    </Link>
  )
}
