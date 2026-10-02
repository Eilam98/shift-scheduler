import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/authContext'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { getStationKey, setStationKey } from '../lib/station'
import type { Language, RestaurantSettings, ShiftLabel, StationDevice } from '../types'

const DAYS = [0, 1, 2, 3, 4, 5, 6]
const inputClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900'

/** /settings — restaurant manager only: availability deadline, default language, default shift times. */
export function SettingsPage() {
  const { t, locale, errorMessage, refreshRestaurantLanguage } = useI18n()
  const [settings, setSettings] = useState<RestaurantSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<RestaurantSettings>('/settings')
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [errorMessage])

  if (loadError) return <Screen title={t('settings.title')}><ErrorMessage>{loadError}</ErrorMessage></Screen>
  if (!settings) return <Screen title={t('settings.title')}><p className="text-slate-500">{t('common.loading')}</p></Screen>

  function change(next: Partial<RestaurantSettings>) {
    setSettings((s) => s && { ...s, ...next })
    setSaved(false)
  }

  function changeTemplate(label: ShiftLabel, field: 'defaultStartTime' | 'defaultEndTime', value: string) {
    change({
      shiftTemplates: settings!.shiftTemplates.map((tpl) => (tpl.label === label ? { ...tpl, [field]: value } : tpl)),
    })
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      const { timeZone: _timeZone, ...body } = settings!
      setSettings(await api<RestaurantSettings>('/settings', { method: 'PATCH', body }))
      refreshRestaurantLanguage()
      setSaved(true)
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Sunday … Saturday in the UI language (2026-09-27 is a Sunday).
  const dayName = (day: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 8, 27 + day))
    )

  return (
    <Screen title={t('settings.title')}>
      <form onSubmit={save} className="space-y-4">
        <Card>
          <h2 className="font-semibold text-slate-900">{t('settings.deadlineTitle')}</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">{t('settings.deadlineHint')}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t('settings.deadlineDay')}</span>
              <select
                className={inputClass}
                value={settings.availabilityDeadlineDay}
                onChange={(e) => change({ availabilityDeadlineDay: Number(e.target.value) })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {dayName(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">{t('settings.deadlineTime')}</span>
              <input
                type="time"
                required
                dir="ltr"
                className={inputClass}
                value={settings.availabilityDeadlineTime}
                onChange={(e) => change({ availabilityDeadlineTime: e.target.value })}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('settings.timeZone', { zone: settings.timeZone })}</p>
        </Card>

        <Card>
          <label className="block">
            <span className="font-semibold text-slate-900">{t('settings.defaultLanguage')}</span>
            <span className="mt-1 block text-sm text-slate-500">{t('settings.defaultLanguageHint')}</span>
            <select
              className={inputClass}
              value={settings.defaultLanguage}
              onChange={(e) => change({ defaultLanguage: e.target.value as Language })}
            >
              <option value="HE">{t('language.HE')}</option>
              <option value="EN">{t('language.EN')}</option>
            </select>
          </label>
        </Card>

        <Card>
          <h2 className="font-semibold text-slate-900">{t('settings.shiftTimes')}</h2>
          <p className="mt-1 mb-4 text-sm text-slate-500">{t('settings.shiftTimesHint')}</p>
          <div className="space-y-3">
            {settings.shiftTemplates.map((tpl) => (
              <div key={tpl.label} className="grid grid-cols-[5rem_1fr_1fr] items-end gap-3">
                <span className="pb-3 text-sm font-medium text-slate-700">{t(`shift.${tpl.label}`)}</span>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('settings.start')}</span>
                  <input
                    type="time"
                    required
                    dir="ltr"
                    className={inputClass}
                    value={tpl.defaultStartTime}
                    onChange={(e) => changeTemplate(tpl.label, 'defaultStartTime', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">{t('settings.end')}</span>
                  <input
                    type="time"
                    required
                    dir="ltr"
                    className={inputClass}
                    value={tpl.defaultEndTime}
                    onChange={(e) => changeTemplate(tpl.label, 'defaultEndTime', e.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        </Card>

        {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
        {saved && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{t('settings.saved')}</p>}
        <Button type="submit" disabled={saving} className="md:w-auto! md:px-8">
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </form>

      <div className="mt-8">
        <StationsCard />
      </div>
    </Screen>
  )
}

/**
 * Time clock stations: turn THIS browser into the time clock (it gets a secret
 * key, you're logged out here and it shows the keypad), and revoke old ones.
 */
function StationsCard() {
  const { t, locale, errorMessage } = useI18n()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [stations, setStations] = useState<StationDevice[] | null>(null)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const thisDeviceIsStation = getStationKey() !== null

  useEffect(() => {
    let cancelled = false
    api<{ stations: StationDevice[] }>('/stations')
      .then((result) => {
        if (!cancelled) setStations(result.stations)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [reloads, errorMessage])

  async function activate() {
    setError(null)
    setBusy(true)
    try {
      const { token } = await api<{ token: string }>('/stations', {
        method: 'POST',
        body: { name: name.trim() || t('stations.defaultName') },
      })
      setStationKey(token)
      navigate('/station')
      logout() // nobody stays logged in on the time clock
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setError(null)
    try {
      await api(`/stations/${id}`, { method: 'DELETE' })
      setReloads((n) => n + 1)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

  return (
    <Card>
      <h2 className="font-semibold text-slate-900">{t('stations.title')}</h2>
      <p className="mt-1 mb-4 text-sm text-slate-500">{t('stations.hint')}</p>

      {stations && stations.length > 0 && (
        <ul className="mb-4 space-y-2">
          {stations.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
              <div className="min-w-0">
                <p className={`font-medium ${s.revokedAt ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.revokedAt
                    ? t('stations.revokedOn', { when: when(s.revokedAt) })
                    : s.lastUsedAt
                      ? t('stations.lastUsed', { when: when(s.lastUsedAt) })
                      : t('stations.neverUsed')}
                </p>
              </div>
              {!s.revokedAt && (
                <button onClick={() => revoke(s.id)} className="shrink-0 text-sm font-medium text-red-600">
                  {t('stations.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {thisDeviceIsStation && <p className="mb-3 text-sm text-amber-700">{t('stations.thisDeviceHasKey')}</p>}

      {confirming ? (
        <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('stations.name')}</span>
            <input
              className={inputClass}
              placeholder={t('stations.defaultName')}
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="text-sm text-slate-600">{t('stations.activateWarning')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="w-auto! py-2!" onClick={() => setConfirming(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button className="w-auto! py-2!" onClick={activate} disabled={busy}>
              {busy ? t('common.saving') : t('stations.activate')}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" className="md:w-auto! md:px-6" onClick={() => setConfirming(true)}>
          {t('stations.useThisDevice')}
        </Button>
      )}
      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </Card>
  )
}
