import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { api } from '../lib/api'
import { NotificationsContext, type NotificationsState } from './notificationsContext'

const POLL_MS = 60_000

/**
 * Keeps the unread-notification count fresh for the bell: fetched on load,
 * every minute, when the window regains focus, and on every page change.
 * (Phone push in step 9 will make changes appear even when the app is closed.)
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unread, setUnread] = useState(0)
  const [version, setVersion] = useState(0)
  const { pathname } = useLocation()

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    api<{ unreadCount: number }>('/notifications/unread-count')
      .then(({ unreadCount }) => {
        if (!cancelled) setUnread(unreadCount)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [version, pathname])

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  const value = useMemo<NotificationsState>(() => ({ unread, refresh }), [unread, refresh])
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}
