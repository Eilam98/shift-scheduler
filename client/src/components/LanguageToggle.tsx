import { useAuth } from '../auth/authContext'
import { useI18n } from '../i18n/i18nContext'
import type { Language } from '../types'

const LANGUAGES: Language[] = ['HE', 'EN']

/**
 * עברית / English switch. Always on the physical right with the same order
 * in both languages (dir="ltr" pins it, so switching to Hebrew doesn't move it).
 * Logged in it saves the user's language; logged out it's kept on the device.
 */
export function LanguageToggle() {
  const { user, saveLanguage } = useAuth()
  const { t, language, setGuestLanguage } = useI18n()

  function choose(next: Language) {
    setGuestLanguage(next) // also used after logging out
    if (user && user.language !== next) saveLanguage(next).catch(() => {})
  }

  return (
    <div dir="ltr" className="flex gap-1">
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          onClick={() => choose(lang)}
          aria-pressed={language === lang}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            language === lang ? 'bg-indigo-100 text-indigo-800' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t(`language.${lang}`)}
        </button>
      ))}
    </div>
  )
}

/**
 * Full-width strip at the top of every page holding the toggle. It spans the
 * whole window (above the side menu) and stays on screen when scrolling, so
 * the toggle is always at the same spot on the right whatever the language.
 * Height h-12 (3rem): AppShell's side menu sits just below it.
 */
export function LanguageBar() {
  return (
    <div className="sticky top-0 z-20 flex h-12 items-center justify-end border-b border-slate-200 bg-white px-4" dir="ltr">
      <LanguageToggle />
    </div>
  )
}
