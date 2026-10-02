import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { WeekNav } from '../components/WeekNav'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { addDays, formatDay, isWeekStart } from '../lib/dates'
import { formatDuration, formatTime, toZonedInput, zonedDate } from '../lib/time'
import type { AttendanceEntry, AttendanceWeek } from '../types'

const inputClass = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900'

type EntryChange =
  | { kind: 'updated' | 'created'; entry: AttendanceEntry }
  | { kind: 'deleted'; id: string }

/** Needs a manager: unscheduled and not approved yet, no department, or no clock-out after 16 h. */
function needsAttention(e: AttendanceEntry): boolean {
  return (e.flagged && !e.reviewedAt) || !e.department || e.missingClockOut
}

/**
 * /attendance?week=YYYY-MM-DD — managers: a week of time clock entries for
 * their hourly departments (restaurant manager: all). Fix times and missed
 * clock-outs, assign a department, approve flagged entries, add or delete.
 */
export function AttendancePage() {
  const { t, locale, errorMessage, departmentName } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const week = isWeekStart(weekParam) ? weekParam : null
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [data, setData] = useState<AttendanceWeek | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (week) params.set('week', week)
    if (departmentId) params.set('departmentId', departmentId)
    api<AttendanceWeek>(`/attendance?${params}`)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [week, departmentId, reloads, errorMessage])

  // Apply the server's answer right away (saves are slow over the dev DB link),
  // then refetch in the background so filters and other changes stay correct.
  const applyChange = (change: EntryChange) => {
    setData((d) => {
      if (!d) return d
      const entries =
        change.kind === 'deleted'
          ? d.entries.filter((e) => e.id !== change.id)
          : change.kind === 'created'
            ? [...d.entries, change.entry].sort((a, b) => a.clockIn.localeCompare(b.clockIn))
            : d.entries.map((e) => (e.id === change.entry.id ? change.entry : e))
      return { ...d, entries }
    })
    setOpenId(null)
    setAdding(false)
    setReloads((n) => n + 1)
  }

  if (error) return <Screen title={t('attendance.title')}><ErrorMessage>{error}</ErrorMessage></Screen>
  if (!data) return <Screen title={t('attendance.title')}><p className="text-slate-500">{t('common.loading')}</p></Screen>

  if (data.departments.length === 0) {
    return (
      <Screen title={t('attendance.title')}>
        <Card>
          <p className="text-slate-600">{t('attendance.noHourlyDepartments')}</p>
        </Card>
      </Screen>
    )
  }

  const attentionCount = data.entries.filter(needsAttention).length
  const shown = onlyAttention ? data.entries.filter(needsAttention) : data.entries
  const days = new Map<string, AttendanceEntry[]>()
  for (const e of shown) {
    const day = zonedDate(e.clockIn, data.timeZone)
    days.set(day, [...(days.get(day) ?? []), e])
  }

  return (
    <Screen wide title={t('attendance.title')}>
      <WeekNav
        weekStart={data.weekStartDate}
        onPrev={() => setSearchParams({ week: addDays(data.weekStartDate, -7) })}
        onNext={() => setSearchParams({ week: addDays(data.weekStartDate, 7) })}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {data.departments.length > 1 &&
          [{ id: null, name: t('availability.allDepartments') }, ...data.departments].map((d) => (
            <button
              key={d.id ?? 'all'}
              onClick={() => setDepartmentId(d.id)}
              aria-pressed={departmentId === d.id}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                departmentId === d.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100'
              }`}
            >
              {d.id ? departmentName(d.name) : d.name}
            </button>
          ))}
        <button
          onClick={() => setOnlyAttention((v) => !v)}
          aria-pressed={onlyAttention}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            onlyAttention ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
          }`}
        >
          {t('attendance.needsAttention', { count: attentionCount })}
        </button>
        <Button className="w-auto! py-2! text-sm! ms-auto" onClick={() => { setAdding(true); setOpenId(null) }}>
          {t('attendance.addEntry')}
        </Button>
      </div>

      {adding && (
        <div className="mb-4 md:max-w-2xl">
          <EntryEditor data={data} onDone={applyChange} onCancel={() => setAdding(false)} />
        </div>
      )}

      {shown.length === 0 ? (
        <Card>
          <p className="text-slate-500">{onlyAttention ? t('attendance.nothingToReview') : t('attendance.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-4 md:max-w-3xl">
          {[...days].map(([day, entries]) => (
            <section key={day}>
              <h2 className="mb-2 font-semibold text-slate-900">{formatDay(day, locale)}</h2>
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li key={e.id}>
                    {openId === e.id ? (
                      <EntryEditor data={data} entry={e} onDone={applyChange} onCancel={() => setOpenId(null)} />
                    ) : (
                      <EntryRow entry={e} timeZone={data.timeZone} onOpen={() => { setOpenId(e.id); setAdding(false) }} />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Screen>
  )
}

function EntryRow({ entry: e, timeZone, onOpen }: { entry: AttendanceEntry; timeZone: string; onOpen: () => void }) {
  const { t, departmentName } = useI18n()
  return (
    <button onClick={onOpen} className="w-full rounded-2xl bg-white p-4 text-start shadow-sm hover:bg-slate-50">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-slate-900">{e.user.name}</p>
        <p className="text-sm text-slate-700">
          <span dir="ltr">
            {formatTime(e.clockIn, timeZone)} – {e.clockOut ? formatTime(e.clockOut, timeZone) : '…'}
          </span>
          {e.clockOut && <span className="ms-2 text-slate-500">({formatDuration(e.clockIn, e.clockOut)})</span>}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
        {e.department ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{departmentName(e.department.name)}</span>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{t('attendance.noDepartment')}</span>
        )}
        {e.missingClockOut && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">{t('attendance.missingClockOut')}</span>
        )}
        {!e.clockOut && !e.missingClockOut && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">{t('attendance.stillIn')}</span>
        )}
        {e.flagged && !e.reviewedAt && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{t('attendance.notScheduled')}</span>
        )}
        {e.reviewedBy && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{t('attendance.approvedBy', { name: e.reviewedBy })}</span>
        )}
        {e.source === 'MANUAL' ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{t('attendance.manual', { name: e.enteredBy ?? '' })}</span>
        ) : (
          e.enteredBy && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{t('attendance.editedBy', { name: e.enteredBy })}</span>
          )
        )}
      </div>
      {e.note && <p className="mt-2 text-sm text-slate-600">“{e.note}”</p>}
    </button>
  )
}

/** Edit an entry (times, department, note, approve, delete) — or add a new one when `entry` is missing. */
function EntryEditor({
  data,
  entry,
  onDone,
  onCancel,
}: {
  data: AttendanceWeek
  entry?: AttendanceEntry
  onDone: (change: EntryChange) => void
  onCancel: () => void
}) {
  const { t, errorMessage, departmentName } = useI18n()
  const tz = data.timeZone
  const [userId, setUserId] = useState(entry?.user.id ?? '')
  const [departmentId, setDepartmentId] = useState(entry?.department?.id ?? '')
  const [clockIn, setClockIn] = useState(() => {
    if (entry) return toZonedInput(entry.clockIn, tz)
    // New entry: today at 08:00 if today is in the week shown, else the week's Sunday.
    const today = zonedDate(new Date().toISOString(), tz)
    const inWeek = today >= data.weekStartDate && today <= addDays(data.weekStartDate, 6)
    return `${inWeek ? today : data.weekStartDate}T08:00`
  })
  const [clockOut, setClockOut] = useState(entry?.clockOut ? toZonedInput(entry.clockOut, tz) : '')
  const [note, setNote] = useState(entry?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const worker = data.workers.find((w) => w.id === userId)
  const departmentOptions = data.departments.filter((d) => worker?.departmentIds.includes(d.id))

  async function run(action: () => Promise<EntryChange>) {
    setError(null)
    setBusy(true)
    try {
      onDone(await action())
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const save = (approve = false) =>
    run(async () =>
      entry
        ? {
            kind: 'updated',
            entry: await api<AttendanceEntry>(`/attendance/${entry.id}`, {
            method: 'PATCH',
            body: {
              clockIn,
              clockOut: clockOut || null,
              note: note || null,
              ...(departmentId && departmentId !== entry.department?.id && { departmentId }),
              ...(approve && { approve: true }),
            },
          }),
          }
        : {
            kind: 'created',
            entry: await api<AttendanceEntry>('/attendance', {
              method: 'POST',
              body: { userId, departmentId, clockIn, clockOut: clockOut || null, note: note || null },
            }),
          }
    )

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-2 ring-indigo-200">
      <p className="mb-3 font-semibold text-slate-900">{entry ? entry.user.name : t('attendance.addEntry')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {!entry && (
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('attendance.worker')}</span>
            <select className={inputClass} value={userId} onChange={(e) => { setUserId(e.target.value); setDepartmentId('') }}>
              <option value="">—</option>
              {data.workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('schedule.department')}</span>
          <select className={inputClass} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">{entry && !entry.department ? t('attendance.noDepartment') : '—'}</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {departmentName(d.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('attendance.clockIn')}</span>
          <input type="datetime-local" dir="ltr" required className={inputClass} value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('attendance.clockOut')}</span>
          <input type="datetime-local" dir="ltr" className={inputClass} value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">{t('attendance.clockOutHint')}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">{t('availability.note')}</span>
          <input className={inputClass} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      {entry?.shift && (
        <p className="mt-2 text-xs text-slate-500">
          {t('attendance.scheduledFor', { shift: t(`shift.${entry.shift.label}`), time: `${entry.shift.startTime}–${entry.shift.endTime}` })}
        </p>
      )}
      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" className="w-auto! py-2!" onClick={onCancel} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button className="w-auto! py-2!" onClick={() => save()} disabled={busy || (!entry && (!userId || !departmentId))}>
          {busy ? t('common.saving') : t('common.save')}
        </Button>
        {entry?.flagged && !entry.reviewedAt && (
          <Button className="w-auto! bg-green-600! py-2! hover:bg-green-700!" onClick={() => save(true)} disabled={busy}>
            {t('attendance.saveAndApprove')}
          </Button>
        )}
        {entry &&
          (confirmDelete ? (
            <Button
              className="w-auto! bg-red-600! py-2! hover:bg-red-700! ms-auto"
              onClick={() =>
                run(async () => {
                  await api(`/attendance/${entry.id}`, { method: 'DELETE' })
                  return { kind: 'deleted', id: entry.id }
                })
              }
              disabled={busy}
            >
              {t('attendance.confirmDelete')}
            </Button>
          ) : (
            <Button variant="secondary" className="w-auto! py-2! text-red-700! ms-auto" onClick={() => setConfirmDelete(true)} disabled={busy}>
              {t('attendance.delete')}
            </Button>
          ))}
      </div>
    </div>
  )
}
