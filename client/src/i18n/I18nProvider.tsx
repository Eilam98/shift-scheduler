import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import { ApiError, api } from '../lib/api'
import type { Language } from '../types'
import { I18nContext, type I18nState, type Params } from './i18nContext'
import { LOCALES, messages, type MessageKey } from './messages'

const LANGUAGE_KEY = 'shift-organizer.language'

function readStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY)
    return stored === 'HE' || stored === 'EN' ? stored : null
  } catch {
    return null
  }
}

/**
 * Picks the UI language and keeps <html lang dir> in sync, so the whole page
 * flips to right-to-left for Hebrew. Logged in: the user's own choice, else
 * the restaurant default. Logged out: the last language used on this device
 * (or the login screen toggle), else the restaurant default. Hebrew if unknown.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [restaurantDefault, setRestaurantDefault] = useState<Language | null>(null)
  const [guestLanguage, setGuestLanguageState] = useState<Language | null>(readStoredLanguage)

  useEffect(() => {
    let cancelled = false
    api<{ defaultLanguage: Language }>('/settings/public')
      .then(({ defaultLanguage }) => {
        if (!cancelled) setRestaurantDefault(defaultLanguage)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const language: Language = user
    ? (user.language ?? restaurantDefault ?? guestLanguage ?? 'HE')
    : (guestLanguage ?? restaurantDefault ?? 'HE')
  const dir = language === 'HE' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = language.toLowerCase()
    document.documentElement.dir = dir
    try {
      localStorage.setItem(LANGUAGE_KEY, language) // next visit starts in the same language
    } catch {
      // storage unavailable (private mode) — the default is fine
    }
  }, [language, dir])

  const t = useCallback(
    (key: MessageKey, params?: Params) => {
      const text = messages[language][key]
      return params ? text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? '')) : text
    },
    [language]
  )

  const departmentName = useCallback(
    (name: string) => {
      const key = `department.${name}`
      return key in messages[language] ? t(key as MessageKey) : name
    },
    [language, t]
  )

  const errorMessage = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        const key = `error.${err.code}`
        if (err.code && key in messages[language]) {
          const params = { ...err.params }
          if (params.department) params.department = departmentName(params.department)
          return t(key as MessageKey, params)
        }
        if (err.status >= 500) return t('error.server')
        return err.message // untranslated server message (validation/programming errors)
      }
      return t('error.generic') // network failure etc.
    },
    [language, t, departmentName]
  )

  const setGuestLanguage = useCallback((next: Language) => setGuestLanguageState(next), [])

  const value = useMemo<I18nState>(
    () => ({
      language,
      dir,
      locale: LOCALES[language],
      restaurantLanguage: restaurantDefault ?? 'HE',
      t,
      errorMessage,
      departmentName,
      setGuestLanguage,
    }),
    [language, dir, restaurantDefault, t, errorMessage, departmentName, setGuestLanguage]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
