import { createContext, useContext } from 'react'

export interface NotificationsState {
  unread: number
  /** Re-fetch the unread count now (e.g. after marking all read). */
  refresh: () => void
}

export const NotificationsContext = createContext<NotificationsState | null>(null)

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationsProvider>')
  return ctx
}
