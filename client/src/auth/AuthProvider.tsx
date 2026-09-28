import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api, getToken, setToken } from '../lib/api'
import type { Language, User } from '../types'
import { AuthContext, type AuthState } from './authContext'

/**
 * Holds the logged-in user for the whole app. On page load, if a token is
 * saved, it asks /api/auth/me who we are (so a refresh keeps you logged in);
 * an invalid or expired token is discarded.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => getToken() !== null)

  useEffect(() => {
    if (!getToken()) return
    // Ignore a late /me response if this effect was cleaned up (React dev
    // StrictMode runs effects twice) or the user logged out meanwhile —
    // otherwise a slow response would log them straight back in.
    let cancelled = false
    api<{ user: User }>('/auth/me')
      .then(({ user }) => {
        if (!cancelled && getToken()) setUser(user)
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 401) setToken(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setToken(token)
    setUser(user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api('/auth/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
      })
      const { user } = await api<{ user: User }>('/auth/me') // now requiresPasswordChange: false
      setUser(user)
    },
    []
  )

  const saveLanguage = useCallback(async (language: Language | null) => {
    const { user } = await api<{ user: User }>('/auth/language', {
      method: 'PATCH',
      body: { language },
    })
    setUser(user)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, changePassword, saveLanguage }),
    [user, loading, login, logout, changePassword, saveLanguage]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
