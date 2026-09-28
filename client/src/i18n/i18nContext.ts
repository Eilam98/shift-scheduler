import { createContext, useContext } from 'react'
import type { Language } from '../types'
import type { MessageKey } from './messages'

export type Params = Record<string, string | number>

export interface I18nState {
  language: Language
  dir: 'rtl' | 'ltr'
  locale: string // Intl locale, e.g. "he-IL"
  restaurantLanguage: Language // used when the user has no language of their own
  t: (key: MessageKey, params?: Params) => string
  /** Translated text for a thrown error (server `code`, network failure, …). */
  errorMessage: (err: unknown) => string
  /** Seeded department names are stored in English; show them translated. */
  departmentName: (name: string) => string
  /** Re-read the restaurant default language (after Settings changes it). */
  refreshRestaurantLanguage: () => void
  /** Language used while logged out (the login screen toggle). */
  setGuestLanguage: (language: Language) => void
}

export const I18nContext = createContext<I18nState | null>(null)

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
