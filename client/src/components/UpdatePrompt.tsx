import { useRegisterSW } from 'virtual:pwa-register/react'
import { useI18n } from '../i18n/i18nContext'

/**
 * Registers the service worker and, when a new version of the app has been
 * deployed, offers to reload into it (the old version keeps working until then).
 */
export function UpdatePrompt() {
  const { t } = useI18n()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 p-4 text-sm text-white shadow-xl md:bottom-6"
    >
      <span>{t('update.available')}</span>
      <span className="flex shrink-0 gap-2">
        <button onClick={() => setNeedRefresh(false)} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
          {t('update.later')}
        </button>
        <button onClick={() => void updateServiceWorker(true)} className="rounded-lg bg-white px-3 py-1.5 font-semibold text-slate-900">
          {t('update.reload')}
        </button>
      </span>
    </div>
  )
}
