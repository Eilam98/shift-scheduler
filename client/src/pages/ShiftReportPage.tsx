import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { formatDay } from '../lib/dates'
import { agorotToInput, formatHours, formatShekels, minutesBetween, parseShekels, splitTips } from '../lib/tips'
import type { RecentReportShift, ShiftLabel, ShiftReport } from '../types'

const inputClass = 'block w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900'

type Row = { userId: string; name: string; departmentId: string; start: string; end: string }

/**
 * /shift-report?date=YYYY-MM-DD&label=MORNING|EVENING — shift managers (and
 * the restaurant manager): each tips worker's hours + the shift's total tips,
 * with each person's share shown live. Saving replaces the shift's report.
 */
export function ShiftReportPage() {
  const { t, locale } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const [recent, setRecent] = useState<RecentReportShift[] | null>(null)
  const [recentReloads, setRecentReloads] = useState(0)
  const date = searchParams.get('date')
  const label = searchParams.get('label') as ShiftLabel | null

  useEffect(() => {
    let cancelled = false
    api<{ shifts: RecentReportShift[] }>('/shift-reports/recent')
      .then(({ shifts }) => {
        if (!cancelled) setRecent(shifts)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [recentReloads])

  // No shift chosen yet: open the most recent one that has ended.
  useEffect(() => {
    if (date && label) return
    const pick = recent?.find((s) => s.ended) ?? recent?.[0]
    if (pick) setSearchParams({ date: pick.date, label: pick.label }, { replace: true })
  }, [date, label, recent, setSearchParams])

  const choose = (d: string, l: ShiftLabel) => setSearchParams({ date: d, label: l })

  return (
    <Screen wide title={t('report.title')}>
      {recent && recent.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {recent.map((s) => {
            const selected = s.date === date && s.label === label
            return (
              <button
                key={`${s.date}/${s.label}`}
                onClick={() => choose(s.date, s.label)}
                aria-pressed={selected}
                className={`shrink-0 rounded-xl px-3 py-2 text-start text-xs shadow-sm ${
                  selected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                <span className="block font-semibold">{formatDay(s.date, locale)}</span>
                <span className="block">
                  {t(`shift.${s.label}`)} ·{' '}
                  {s.hasReport ? (
                    <span className={selected ? '' : 'text-green-700'}>✓ {t('report.saved')}</span>
                  ) : (
                    <span className={selected ? '' : 'text-amber-700'}>{s.ended ? t('report.missing') : t('report.inProgress')}</span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2 md:max-w-md">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('report.date')}</span>
          <input
            type="date"
            dir="ltr"
            className={`mt-1 ${inputClass}`}
            value={date ?? ''}
            onChange={(e) => e.target.value && choose(e.target.value, label ?? 'EVENING')}
          />
        </label>
        <div role="tablist" className="inline-flex rounded-xl bg-white p-1 shadow-sm">
          {(['MORNING', 'EVENING'] as const).map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={label === l}
              onClick={() => date && choose(date, l)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${label === l ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {t(`shift.${l}`)}
            </button>
          ))}
        </div>
      </div>

      {date && label ? (
        <ReportForm key={`${date}/${label}`} date={date} label={label} onSaved={() => setRecentReloads((n) => n + 1)} />
      ) : (
        <p className="text-slate-500">{t('common.loading')}</p>
      )}
    </Screen>
  )
}

function ReportForm({ date, label, onSaved }: { date: string; label: ShiftLabel; onSaved: () => void }) {
  const { t, locale, errorMessage, departmentName } = useI18n()
  const [data, setData] = useState<ShiftReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [totalInput, setTotalInput] = useState('')
  const [adding, setAdding] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedNow, setSavedNow] = useState(false)

  function apply(report: ShiftReport) {
    setData(report)
    setRows(report.rows.map(({ userId, name, departmentId, start, end }) => ({ userId, name, departmentId, start, end })))
    setTotalInput(agorotToInput(report.report?.totalAmount ?? 0))
  }

  useEffect(() => {
    let cancelled = false
    api<ShiftReport>(`/shift-reports?date=${date}&label=${label}`)
      .then((report) => {
        if (!cancelled) apply(report)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [date, label, errorMessage])

  if (loadError) return <ErrorMessage>{loadError}</ErrorMessage>
  if (!data) return <p className="text-slate-500">{t('common.loading')}</p>

  const total = parseShekels(totalInput)
  const minutes = rows.map((r) => minutesBetween(r.start, r.end))
  const shares = splitTips(total ?? 0, minutes)
  const totalMinutes = minutes.reduce((a, b) => a + b, 0)
  const notListed = data.candidates.filter((c) => !rows.some((r) => r.userId === c.id))

  function change(i: number, patch: Partial<Row>) {
    setSavedNow(false)
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  function addWorker(userId: string) {
    const c = data!.candidates.find((x) => x.id === userId)
    if (!c) return
    setSavedNow(false)
    setRows((rs) => [
      ...rs,
      { userId: c.id, name: c.name, departmentId: c.departmentIds[0], start: data!.shift.startTime, end: data!.shift.endTime },
    ])
    setAdding('')
  }

  async function save() {
    if (total === null) return setSaveError(t('report.badAmount'))
    setSaveError(null)
    setSaving(true)
    try {
      apply(
        await api<ShiftReport>(`/shift-reports/${data!.shift.id}`, {
          method: 'PUT',
          body: { totalAmount: total, rows: rows.map(({ userId, departmentId, start, end }) => ({ userId, departmentId, start, end })) },
        })
      )
      setSavedNow(true)
      onSaved()
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const savedAt = data.report
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short', timeZone: data.timeZone }).format(new Date(data.report.updatedAt))
    : null

  return (
    <div className="space-y-4 md:max-w-3xl">
      <Card className="p-4">
        <p className="font-semibold text-slate-900">
          {formatDay(data.shift.date, locale)} · {t(`shift.${data.shift.label}`)}{' '}
          <span className="font-normal text-slate-500" dir="ltr">
            ({data.shift.startTime}–{data.shift.endTime})
          </span>
        </p>
        <p className={`mt-1 text-sm ${data.report ? 'text-green-700' : 'text-amber-700'}`}>
          {data.report ? t('report.savedBy', { name: data.report.enteredBy, when: savedAt! }) : t('report.notSavedYet')}
        </p>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 font-semibold text-slate-900">{t('report.workers')}</h2>
        {rows.length === 0 && <p className="mb-3 text-sm text-slate-500">{t('report.noWorkers')}</p>}
        <ul className="space-y-2">
          {rows.map((r, i) => {
            const candidate = data.candidates.find((c) => c.id === r.userId)
            const departments = data.departments.filter((d) => candidate?.departmentIds.includes(d.id))
            return (
              <li key={r.userId} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{r.name}</p>
                  <button
                    aria-label={t('report.remove', { name: r.name })}
                    onClick={() => {
                      setSavedNow(false)
                      setRows((rs) => rs.filter((_, j) => j !== i))
                    }}
                    className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  {departments.length > 1 ? (
                    <select
                      aria-label={t('schedule.department')}
                      className={`col-span-2 sm:col-span-1 ${inputClass}`}
                      value={r.departmentId}
                      onChange={(e) => change(i, { departmentId: e.target.value })}
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {departmentName(d.name)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="col-span-2 self-center text-sm text-slate-600 sm:col-span-1">
                      {departmentName(data.departments.find((d) => d.id === r.departmentId)?.name ?? '')}
                    </p>
                  )}
                  <label className="block">
                    <span className="text-xs text-slate-500">{t('report.start')}</span>
                    <input type="time" dir="ltr" className={inputClass} value={r.start} onChange={(e) => change(i, { start: e.target.value })} />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-500">{t('report.end')}</span>
                    <input type="time" dir="ltr" className={inputClass} value={r.end} onChange={(e) => change(i, { end: e.target.value })} />
                  </label>
                  <div className="col-span-2 flex items-baseline justify-between gap-3 sm:col-span-1 sm:block sm:text-end">
                    <p className="text-xs text-slate-500" dir="ltr">
                      {formatHours(minutes[i])} {t('report.hoursShort')}
                    </p>
                    <p className="font-semibold text-slate-900">{formatShekels(shares[i], locale)}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        {notListed.length > 0 && (
          <label className="mt-3 block">
            <span className="text-sm font-medium text-slate-700">{t('report.addWorker')}</span>
            <select className={`mt-1 ${inputClass}`} value={adding} onChange={(e) => addWorker(e.target.value)}>
              <option value="">—</option>
              {notListed.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </Card>

      <Card className="p-4">
        <label className="block">
          <span className="font-semibold text-slate-900">{t('report.totalTips')}</span>
          <div className="mt-2 flex items-center gap-2" dir="ltr">
            <span className="text-lg text-slate-500">₪</span>
            <input
              inputMode="decimal"
              placeholder="0"
              className={`${inputClass} max-w-48 text-lg`}
              value={totalInput}
              onChange={(e) => {
                setSavedNow(false)
                setTotalInput(e.target.value)
              }}
            />
          </div>
        </label>
        {total === null && <p className="mt-1 text-sm text-red-700">{t('report.badAmount')}</p>}
        <p className="mt-3 text-sm text-slate-600">
          {t('report.summary', {
            hours: formatHours(totalMinutes),
            people: rows.length,
            perHour: totalMinutes > 0 && total ? formatShekels(Math.round((total * 60) / totalMinutes), locale) : '—',
          })}
        </p>
      </Card>

      {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
      {savedNow && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{t('report.savedNow')}</p>}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4">
        <Button onClick={save} disabled={saving || total === null} className="shadow-lg md:w-auto! md:px-8">
          {saving ? t('common.saving') : data.report ? t('report.saveChanges') : t('report.save')}
        </Button>
      </div>
    </div>
  )
}
