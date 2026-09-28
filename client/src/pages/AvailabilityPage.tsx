import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import { AvailabilityWeekEditor } from '../components/AvailabilityWeekEditor'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { WeekNav } from '../components/WeekNav'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { STATUS_CLASSES, STATUS_LABEL, STATUS_SYMBOL, describeDeadline } from '../lib/availability'
import { addDays, isWeekStart } from '../lib/dates'
import type {
  AvailabilityEntry,
  AvailabilityWeekInfo,
  Department,
  TeamAvailability,
  WeekSubmission,
} from '../types'

type View = 'mine' | 'team'

/**
 * /availability?view=mine|team&week=YYYY-MM-DD
 * "Mine": submit your week until the deadline.
 * "Team" (הגשות העובדים, managers): everyone in your departments; you can
 * change anyone's week at any time, even after the deadline.
 * Without ?week the server picks the next week that's still open.
 */
export function AvailabilityPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  if (!user) return null

  const worksShifts = user.memberships.length > 0
  const isManager = user.isRestaurantManager || user.managedDepartments.length > 0
  const view: View = !worksShifts || (isManager && searchParams.get('view') === 'team') ? 'team' : 'mine'
  const weekParam = searchParams.get('week')
  const week = isWeekStart(weekParam) ? weekParam : null

  function go(next: { view?: View; week?: string | null }) {
    const params: Record<string, string> = {}
    const v = next.view ?? view
    if (v === 'team') params.view = 'team'
    const w = next.week === undefined ? week : next.week
    if (w) params.week = w
    setSearchParams(params)
  }

  return (
    <Screen wide title={t('availability.title')}>
      {isManager && worksShifts && (
        <div role="tablist" className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
          {(['mine', 'team'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => go({ view: v })}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                view === v ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {v === 'mine' ? t('availability.mine') : t('availability.team')}
            </button>
          ))}
        </div>
      )}

      {view === 'mine' ? (
        <MyAvailability key={week ?? 'next'} week={week} onWeek={(w) => go({ week: w })} />
      ) : (
        <TeamSubmissions key={week ?? 'next'} week={week} onWeek={(w) => go({ week: w })} />
      )}
    </Screen>
  )
}

/** "Due Wed 30 Sep, 23:59 · in 2 days" / "Locked", under the week dates. */
function DeadlineLine({ info }: { info: AvailabilityWeekInfo }) {
  const { t, locale } = useI18n()
  const { when, relative } = describeDeadline(info.deadline, info.timeZone, locale)
  return info.locked ? (
    <p className="text-xs font-semibold text-slate-500">{t('availability.lockedShort', { when })}</p>
  ) : (
    <p className="text-xs font-semibold text-amber-700">{t('availability.due', { when, relative })}</p>
  )
}

type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

function MyAvailability({ week, onWeek }: { week: string | null; onWeek: (week: string) => void }) {
  const { t, errorMessage } = useI18n()
  const [loaded, setLoaded] = useState<Loaded<AvailabilityWeekInfo & WeekSubmission>>({ status: 'loading' })
  const [entries, setEntries] = useState<AvailabilityEntry[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<AvailabilityWeekInfo & WeekSubmission>(`/availability/me${week ? `?week=${week}` : ''}`)
      .then((data) => {
        if (cancelled) return
        setLoaded({ status: 'ready', data })
        setEntries(data.entries)
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ status: 'error', message: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [week, errorMessage])

  if (loaded.status === 'loading') return <p className="text-slate-500">{t('common.loading')}</p>
  if (loaded.status === 'error') return <ErrorMessage>{loaded.message}</ErrorMessage>
  const data = loaded.data

  async function save() {
    setSaveError(null)
    setSaving(true)
    try {
      const result = await api<AvailabilityWeekInfo & WeekSubmission>(`/availability/me/${data.weekStartDate}`, {
        method: 'PUT',
        body: { entries },
      })
      setLoaded({ status: 'ready', data: result })
      setEntries(result.entries)
      setDirty(false)
      setSaved(true)
    } catch (err) {
      setSaveError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="md:max-w-4xl">
      <WeekNav
        weekStart={data.weekStartDate}
        onPrev={() => onWeek(addDays(data.weekStartDate, -7))}
        onNext={() => onWeek(addDays(data.weekStartDate, 7))}
      >
        <DeadlineLine info={data} />
      </WeekNav>

      <div className="mb-4 space-y-2">
        <SubmissionStatus submission={data} />
        {data.locked && (
          <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{t('availability.lockedHelp')}</p>
        )}
        {saved && !dirty && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{t('availability.saved')}</p>
        )}
      </div>

      <AvailabilityWeekEditor
        entries={entries}
        readOnly={data.locked}
        onChange={(next) => {
          setEntries(next)
          setDirty(true)
          setSaved(false)
        }}
      />

      {!data.locked && (
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-4 space-y-2 md:bottom-4">
          {saveError && <ErrorMessage>{saveError}</ErrorMessage>}
          <Button onClick={save} disabled={saving || (data.submitted && !dirty)} className="shadow-lg md:w-auto! md:px-8">
            {saving ? t('common.saving') : data.submitted ? t('availability.saveChanges') : t('availability.submit')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** "Submitted" / "Not submitted yet" (+ "Changed by <manager>"). */
function SubmissionStatus({ submission }: { submission: WeekSubmission }) {
  const { t } = useI18n()
  return (
    <p className="text-sm">
      {submission.submitted ? (
        <span className="font-medium text-green-700">{t('availability.submitted')}</span>
      ) : (
        <span className="font-medium text-amber-700">{t('availability.notSubmitted')}</span>
      )}
      {submission.updatedBy && (
        <span className="text-slate-500">
          {' · '}
          {t('availability.changedBy', { name: submission.updatedBy.name })}
        </span>
      )}
    </p>
  )
}

/** הגשות העובדים — the submissions of everyone in the departments I manage. */
function TeamSubmissions({ week, onWeek }: { week: string | null; onWeek: (week: string) => void }) {
  const { user } = useAuth()
  const { t, errorMessage, departmentName } = useI18n()
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded<TeamAvailability>>({ status: 'loading' })
  const [allDepartments, setAllDepartments] = useState<Department[]>([])
  const [openWorkerId, setOpenWorkerId] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  const isRestaurantManager = !!user?.isRestaurantManager
  useEffect(() => {
    if (!isRestaurantManager) return
    let cancelled = false
    api<{ departments: Department[] }>('/departments')
      .then(({ departments }) => {
        if (!cancelled) setAllDepartments(departments)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isRestaurantManager])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (week) params.set('week', week)
    if (departmentId) params.set('departmentId', departmentId)
    api<TeamAvailability>(`/availability/team?${params}`)
      .then((data) => {
        if (!cancelled) setLoaded({ status: 'ready', data })
      })
      .catch((err) => {
        if (!cancelled) setLoaded({ status: 'error', message: errorMessage(err) })
      })
    return () => {
      cancelled = true
    }
  }, [week, departmentId, reloads, errorMessage])

  if (!user) return null
  const departments: Department[] = isRestaurantManager
    ? allDepartments
    : user.managedDepartments.map((d) => ({ id: d.departmentId, name: d.departmentName }))

  if (loaded.status === 'loading') return <p className="text-slate-500">{t('common.loading')}</p>
  if (loaded.status === 'error') return <ErrorMessage>{loaded.message}</ErrorMessage>
  const data = loaded.data
  const submittedCount = data.workers.filter((w) => w.submitted).length

  return (
    <div>
      <WeekNav
        weekStart={data.weekStartDate}
        onPrev={() => onWeek(addDays(data.weekStartDate, -7))}
        onNext={() => onWeek(addDays(data.weekStartDate, 7))}
      >
        <DeadlineLine info={data} />
      </WeekNav>

      {departments.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          {[{ id: null, name: t('availability.allDepartments') }, ...departments].map((d) => (
            <button
              key={d.id ?? 'all'}
              onClick={() => {
                setDepartmentId(d.id)
                setOpenWorkerId(null)
              }}
              aria-pressed={departmentId === d.id}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                departmentId === d.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100'
              }`}
            >
              {d.id ? departmentName(d.name) : d.name}
            </button>
          ))}
        </div>
      )}

      <p className="mb-3 text-sm text-slate-600">
        {t('availability.submittedCount', { count: submittedCount, total: data.workers.length })}
        <span className="ms-3 text-slate-400">{t('availability.managerCanEdit')}</span>
      </p>

      {data.workers.length === 0 ? (
        <Card>
          <p className="text-slate-500">{t('availability.noWorkers')}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.workers.map((worker) => (
            <li key={worker.id}>
              <WorkerRow
                worker={worker}
                weekStart={data.weekStartDate}
                open={openWorkerId === worker.id}
                onToggle={() => setOpenWorkerId(openWorkerId === worker.id ? null : worker.id)}
                onSaved={() => setReloads((n) => n + 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** "S" / "א" — a one-letter weekday for the compact grid. */
function weekdayLetter(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`)
  )
}

/** One worker: name, departments, status and the 14 shifts as coloured cells; opens an editor. */
function WorkerRow({
  worker,
  weekStart,
  open,
  onToggle,
  onSaved,
}: {
  worker: TeamAvailability['workers'][number]
  weekStart: string
  open: boolean
  onToggle: () => void
  onSaved: () => void
}) {
  const { t, locale, departmentName, errorMessage } = useI18n()
  const [entries, setEntries] = useState(worker.entries)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    setSaving(true)
    try {
      await api(`/availability/users/${worker.id}/${weekStart}`, { method: 'PUT', body: { entries } })
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <button onClick={onToggle} aria-expanded={open} className="w-full p-4 text-start">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-medium text-slate-900">{worker.name}</p>
          <p className="text-xs text-slate-500">
            {worker.departments.map((d) => departmentName(d.departmentName)).join(', ')}
          </p>
        </div>
        <div className="mt-1">
          <SubmissionStatus submission={worker} />
        </div>
        {/* 7 days × (morning, evening); follows the page direction, so Sunday is on the right in Hebrew */}
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, day) => (
            <div key={day}>
              <p className="mb-0.5 text-center text-[10px] font-medium text-slate-400">
                {weekdayLetter(worker.entries[day * 2].date, locale)}
              </p>
              <div className="grid grid-cols-2 gap-0.5">
              {worker.entries.slice(day * 2, day * 2 + 2).map((e) => {
                const status = worker.submitted ? e.status : 'NONE'
                return (
                  <span
                    key={e.label}
                    title={`${t(`shift.${e.label}`)}: ${t(STATUS_LABEL[status])}${e.note ? ` — ${e.note}` : ''}`}
                    className={`flex h-6 items-center justify-center rounded text-xs font-semibold ${STATUS_CLASSES[status]}`}
                  >
                    {STATUS_SYMBOL[status]}
                  </span>
                )
              })}
              </div>
            </div>
          ))}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <AvailabilityWeekEditor entries={entries} onChange={setEntries} />
          {error && (
            <div className="mt-3">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
          <div className="mt-3 flex gap-2 md:max-w-sm">
            <Button
              variant="secondary"
              onClick={() => {
                setEntries(worker.entries) // drop unsaved changes
                onToggle()
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('common.saving') : t('availability.saveFor', { name: worker.name })}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
