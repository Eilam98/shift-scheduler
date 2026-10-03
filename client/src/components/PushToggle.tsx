import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { ApiError, api } from '../lib/api'

type State =
  | 'checking'
  | 'unsupported' // this browser can't do Web Push
  | 'iosNeedsInstall' // iPhone/iPad: only works from the Home-Screen app
  | 'serverOff' // the server has no push keys
  | 'blocked' // the user blocked notifications for this site
  | 'off'
  | 'on'

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** The VAPID public key (base64url) → the bytes PushManager.subscribe wants. */
function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Profile: turn phone notifications on/off for this device, and send a test. */
export function PushToggle() {
  const { t, errorMessage } = useI18n()
  const [state, setState] = useState<State>('checking')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      let next: State
      if (!supported) next = isIos() && !isStandalone() ? 'iosNeedsInstall' : 'unsupported'
      else if (Notification.permission === 'denied') next = 'blocked'
      else next = (await currentSubscription()) ? 'on' : 'off'
      if (!cancelled) setState(next)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function turnOn() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const { publicKey } = await api<{ publicKey: string }>('/push/key')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }))
      await api('/push/subscribe', { method: 'POST', body: subscription.toJSON() })
      setState('on')
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setState('serverOff')
      else setError(err instanceof ApiError ? errorMessage(err) : t('push.failed'))
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      const subscription = await currentSubscription()
      if (subscription) {
        await api('/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } })
        await subscription.unsubscribe()
      }
      setState('off')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setError(null)
    setBusy(true)
    try {
      await api('/push/test', { method: 'POST', body: { title: t('push.testTitle'), body: t('push.testBody') } })
      setMessage(t('push.testSent'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const help: Partial<Record<State, string>> = {
    unsupported: t('push.unsupported'),
    iosNeedsInstall: t('push.iosNeedsInstall'),
    serverOff: t('push.serverOff'),
    blocked: t('push.blocked'),
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{t('push.title')}</p>
          <p className="text-xs text-slate-500">{state === 'on' ? t('push.onHint') : t('push.offHint')}</p>
        </div>
        {(state === 'on' || state === 'off') && (
          <button
            role="switch"
            aria-checked={state === 'on'}
            aria-label={t('push.title')}
            disabled={busy}
            onClick={state === 'on' ? turnOff : turnOn}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${state === 'on' ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${state === 'on' ? 'start-[1.375rem]' : 'start-0.5'}`}
            />
          </button>
        )}
      </div>
      {help[state] && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{help[state]}</p>}
      {state === 'on' && (
        <button onClick={sendTest} disabled={busy} className="mt-2 text-sm font-medium text-indigo-600 disabled:opacity-60">
          {t('push.sendTest')}
        </button>
      )}
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
