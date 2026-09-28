import { useEffect, useState, type FormEvent } from 'react'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import type { Language, RestaurantSettings, ShiftLabel } from '../types'

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
    </Screen>
  )
}
