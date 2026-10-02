import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { LanguageBar } from '../components/LanguageToggle'
import { useI18n } from '../i18n/i18nContext'
import { ApiError, api } from '../lib/api'
import { getStationKey, setStationKey, stationHeaders } from '../lib/station'
import { formatDuration, formatTime } from '../lib/time'
import type { PunchResult } from '../types'

const PIN_LENGTH = 4
const RESULT_MS = 5000

type State =
  | { kind: 'checking' }
  | { kind: 'inactive' } // this browser isn't an activated time clock
  | { kind: 'ready'; name: string; timeZone: string }

type Feedback = { kind: 'result'; result: PunchResult } | { kind: 'error'; message: string } | null

/**
 * /station — the time clock. Works only in a browser the restaurant manager
 * activated (it holds a station key); nobody is logged in here. Type a PIN to
 * clock in, type it again to clock out. Times come from the server.
 */
export function StationPage() {
  const { t } = useI18n()
  const [state, setState] = useState<State>(() => (getStationKey() ? { kind: 'checking' } : { kind: 'inactive' }))

  useEffect(() => {
    const key = getStationKey()
    if (!key) return // no key: already "inactive"
    let cancelled = false
    api<{ name: string; timeZone: string }>('/station/me', { headers: stationHeaders(key) })
      .then(({ name, timeZone }) => {
        if (!cancelled) setState({ kind: 'ready', name, timeZone })
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'STATION_INVALID') setStationKey(null) // revoked
        setState({ kind: 'inactive' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="flex min-h-dvh flex-col bg-slate-900 text-white">
      <LanguageBar />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {state.kind === 'checking' && <p className="text-slate-400">{t('common.loading')}</p>}
        {state.kind === 'inactive' && (
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold">{t('station.inactiveTitle')}</h1>
            <p className="mt-3 text-slate-300">{t('station.inactiveHelp')}</p>
            <Link to="/" className="mt-6 inline-block rounded-lg bg-white px-5 py-3 font-semibold text-slate-900">
              {t('station.goToLogin')}
            </Link>
          </div>
        )}
        {state.kind === 'ready' && <Keypad stationName={state.name} timeZone={state.timeZone} />}
      </div>
    </main>
  )
}

function Keypad({ stationName, timeZone }: { stationName: string; timeZone: string }) {
  const { t, locale, errorMessage } = useI18n()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [now, setNow] = useState(() => new Date())
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    if (clearTimer.current) clearTimeout(clearTimer.current)
    clearTimer.current = setTimeout(() => setFeedback(null), RESULT_MS)
  }, [])

  const punch = useCallback(
    async (value: string) => {
      const key = getStationKey()
      if (!key) return
      setBusy(true)
      try {
        const result = await api<PunchResult>('/station/punch', {
          method: 'POST',
          body: { pin: value },
          headers: stationHeaders(key),
        })
        showFeedback({ kind: 'result', result })
      } catch (err) {
        if (err instanceof ApiError && err.code === 'STATION_INVALID') {
          setStationKey(null)
          window.location.reload() // revoked meanwhile → shows "not a time clock"
          return
        }
        showFeedback({ kind: 'error', message: errorMessage(err) })
      } finally {
        setBusy(false)
        setPin('')
      }
    },
    [errorMessage, showFeedback]
  )

  const press = useCallback(
    (digit: string) => {
      if (busy || pin.length >= PIN_LENGTH) return
      setFeedback(null)
      const next = pin + digit
      setPin(next)
      if (next.length === PIN_LENGTH) void punch(next) // submit as soon as the 4th digit is in
    },
    [busy, pin, punch]
  )

  const backspace = useCallback(() => setPin((current) => current.slice(0, -1)), [])

  // A physical keyboard works too (handy on a laptop).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, backspace])

  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(now)

  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-sm text-slate-400">{stationName}</p>
      <p className="mt-1 text-6xl font-bold tabular-nums" dir="ltr">
        {formatTime(now.toISOString(), timeZone)}
      </p>
      <p className="mt-1 text-slate-300">{date}</p>

      <div className="mt-6 min-h-24" aria-live="polite">
        {feedback?.kind === 'result' && <PunchMessage result={feedback.result} timeZone={timeZone} />}
        {feedback?.kind === 'error' && (
          <p role="alert" className="rounded-xl bg-red-500/20 px-4 py-3 font-medium text-red-200">
            {feedback.message}
          </p>
        )}
        {!feedback && (
          <>
            <p className="text-slate-300">{t('station.enterPin')}</p>
            <div className="mt-3 flex justify-center gap-3" dir="ltr">
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className={`size-4 rounded-full border-2 border-white ${i < pin.length ? 'bg-white' : ''}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Phone-style keypad order in both languages */}
      <div className="mt-4 grid grid-cols-3 gap-3" dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeyButton key={d} label={d} onClick={() => press(d)} disabled={busy} />
        ))}
        <span />
        <KeyButton label="0" onClick={() => press('0')} disabled={busy} />
        <KeyButton label="⌫" ariaLabel={t('station.backspace')} onClick={backspace} disabled={busy} />
      </div>
      {busy && <p className="mt-4 text-sm text-slate-400">{t('common.saving')}</p>}
    </div>
  )
}

/** "Hi Shira — clocked in 15:58" / "Bye Shira — clocked out 17:30 · worked 7:32". */
function PunchMessage({ result, timeZone }: { result: PunchResult; timeZone: string }) {
  const { t, departmentName } = useI18n()
  const time = formatTime(result.at, timeZone)
  const department = result.department ? departmentName(result.department.name) : null

  return result.action === 'IN' ? (
    <div className="rounded-xl bg-green-500/20 px-4 py-3 text-green-100">
      <p className="text-xl font-semibold">{t('station.clockedIn', { name: result.name, time })}</p>
      <p className="mt-1 text-sm">
        {department ?? t('station.noDepartment')}
        {!result.scheduled && ` · ${t('station.notScheduled')}`}
      </p>
    </div>
  ) : (
    <div className="rounded-xl bg-sky-500/20 px-4 py-3 text-sky-100">
      <p className="text-xl font-semibold">{t('station.clockedOut', { name: result.name, time })}</p>
      {result.clockIn && (
        <p className="mt-1 text-sm">
          {t('station.worked', { duration: formatDuration(result.clockIn, result.at) })}
          {department && ` · ${department}`}
        </p>
      )}
    </div>
  )
}

function KeyButton({
  label,
  ariaLabel,
  onClick,
  disabled,
}: {
  label: string
  ariaLabel?: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="h-16 rounded-2xl bg-white/10 text-2xl font-semibold hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
    >
      {label}
    </button>
  )
}
