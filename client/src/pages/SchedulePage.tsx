import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ChevronEndIcon, ChevronStartIcon } from '../components/icons'
import { ReadOnlyShift } from '../components/ReadOnlyShift'
import { ShiftCard } from '../components/ShiftCard'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { ApiError, api } from '../lib/api'
import { addDays, currentWeekStart, formatDay, formatWeekRange, isWeekStart } from '../lib/dates'
import type { Department, DepartmentWeek, Member, ScheduleStatus, Slot } from '../types'

type Loaded =
  | { kind: 'ready'; week: DepartmentWeek; members: Member[] }
  | { kind: 'missing' } // no schedule created for this week yet
  | { kind: 'notPosted' } // exists, but this department hasn't posted it (viewers only)
  | { kind: 'error'; message: string }

/**
 * /schedule/:departmentId?week=YYYY-MM-DD — one department's week, for
 * everyone. Managers of the department (and the restaurant manager) edit and
 * post it; everyone else sees it read-only once it's posted (Team schedule).
 * Without a departmentId it opens your first managed department, else your
 * first department, else the first one.
 */
export function SchedulePage() {
  const { departmentId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { t, locale, errorMessage, departmentName } = useI18n()
  const weekParam = searchParams.get('week')
  const weekStart = isWeekStart(weekParam) ? weekParam : currentWeekStart()

  const [reloads, setReloads] = useState(0)
  const key = `${departmentId}/${weekStart}/${reloads}`
  const [result, setResult] = useState<{ key: string; data: Loaded } | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [allDepartments, setAllDepartments] = useState<Department[] | null>(null)

  const canManage =
    !!user &&
    (user.isRestaurantManager || user.managedDepartments.some((d) => d.departmentId === departmentId))

  useEffect(() => {
    let cancelled = false
    api<{ departments: Department[] }>('/departments')
      .then(({ departments }) => {
        if (!cancelled) setAllDepartments(departments)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!departmentId) return
    let cancelled = false
    ;(async (): Promise<Loaded> => {
      try {
        const week = await api<DepartmentWeek>(`/schedules/${weekStart}/departments/${departmentId}`)
        const members = week.canEdit
          ? (await api<{ members: Member[] }>(`/departments/${departmentId}/members`)).members
          : []
        return { kind: 'ready', week, members }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { kind: 'missing' }
        if (err instanceof ApiError && err.code === 'SCHEDULE_NOT_POSTED') return { kind: 'notPosted' }
        return { kind: 'error', message: errorMessage(err) }
      }
    })().then((data) => {
      if (!cancelled) setResult({ key, data })
    })
    return () => {
      cancelled = true
    }
  }, [departmentId, weekStart, key, errorMessage])

  if (!user) return null

  if (!departmentId) {
    const target =
      user.managedDepartments[0]?.departmentId ??
      user.memberships[0]?.departmentId ??
      allDepartments?.[0]?.id
    if (target) return <Navigate to={`/schedule/${target}?week=${weekStart}`} replace />
    return (
      <Screen>
        <p className="text-slate-500">{t('common.loading')}</p>
      </Screen>
    ) // waiting for the department list
  }

  const loaded = result?.key === key ? result.data : null

  function goToWeek(offsetDays: number) {
    setSearchParams({ week: addDays(weekStart, offsetDays) })
  }

  async function createWeek() {
    setCreateError(null)
    setCreating(true)
    try {
      await api('/schedules', { method: 'POST', body: { weekStartDate: weekStart } })
      setReloads((n) => n + 1)
    } catch (err) {
      setCreateError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  function updateWeek(change: (week: DepartmentWeek) => DepartmentWeek) {
    setResult((prev) =>
      prev && prev.data.kind === 'ready'
        ? { ...prev, data: { ...prev.data, week: change(prev.data.week) } }
        : prev
    )
  }

  function updateSlots(shiftId: string, slots: Slot[]) {
    updateWeek((week) => ({
      ...week,
      shifts: week.shifts.map((s) => (s.id === shiftId ? { ...s, slots } : s)),
    }))
  }

  const week = loaded?.kind === 'ready' ? loaded.week : null
  const days = week ? groupByDate(week.shifts) : []

  return (
    <Screen
      wide
      title={
        week
          ? t('schedule.title', { department: departmentName(week.departmentName) })
          : t('schedule.titleGeneric')
      }
    >
      {allDepartments && allDepartments.length > 1 && (
        <nav
          aria-label={t('schedule.department')}
          className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0"
        >
          {allDepartments.map((d) => (
            <Link
              key={d.id}
              to={`/schedule/${d.id}?week=${weekStart}`}
              aria-current={d.id === departmentId ? 'page' : undefined}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                d.id === departmentId
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100'
              }`}
            >
              {departmentName(d.name)}
            </Link>
          ))}
        </nav>
      )}

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm md:max-w-md">
        <button
          aria-label={t('schedule.prevWeek')}
          onClick={() => goToWeek(-7)}
          className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
        >
          <ChevronStartIcon className="size-5" />
        </button>
        <div className="text-center">
          <p className="font-medium text-slate-900">{formatWeekRange(weekStart, locale)}</p>
          {week?.canEdit && (
            <p
              className={`text-xs font-semibold tracking-wide uppercase ${
                week.status === 'POSTED' ? 'text-green-700' : 'text-amber-600'
              }`}
            >
              {week.status === 'POSTED' ? t('schedule.posted') : t('schedule.draft')}
            </p>
          )}
        </div>
        <button
          aria-label={t('schedule.nextWeek')}
          onClick={() => goToWeek(7)}
          className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
        >
          <ChevronEndIcon className="size-5" />
        </button>
      </div>

      {!loaded && <p className="text-slate-500">{t('common.loading')}</p>}

      {loaded?.kind === 'error' && <ErrorMessage>{loaded.message}</ErrorMessage>}

      {loaded?.kind === 'notPosted' && (
        <Card className="md:max-w-md">
          <p className="text-slate-700">{t('schedule.notPosted')}</p>
        </Card>
      )}

      {loaded?.kind === 'missing' && (
        <Card className="md:max-w-md">
          <p className="text-slate-700">{canManage ? t('schedule.noWeek') : t('schedule.notPosted')}</p>
          {canManage && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">{t('schedule.createHint')}</p>
              {createError && <ErrorMessage>{createError}</ErrorMessage>}
              <Button onClick={createWeek} disabled={creating}>
                {creating ? t('schedule.creating') : t('schedule.create')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {week && loaded?.kind === 'ready' && week.canEdit && (
        <PostControls
          week={week}
          weekStart={weekStart}
          onStatusChange={(status, postedAt) => updateWeek((w) => ({ ...w, status, postedAt }))}
        />
      )}

      {/* Editor: one day per row on phones, a 2–7 column grid on desktop. */}
      {week && loaded?.kind === 'ready' && week.canEdit && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {days.map(([date, shifts]) => (
            <Card key={date} className="p-4 2xl:p-3">
              <h2 className="mb-3 font-semibold text-slate-900">{formatDay(date, locale)}</h2>
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    departmentId={departmentId}
                    canEdit
                    members={loaded.members}
                    onSlotsChange={(slots) => updateSlots(shift.id, slots)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Team schedule (read-only): names only, so the full week fits in 7 columns sooner. */}
      {week && !week.canEdit && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {days.map(([date, shifts]) => (
            <Card key={date} className="p-4 xl:p-3">
              <h2 className="mb-2 font-semibold text-slate-900">{formatDay(date, locale)}</h2>
              <div className="space-y-3">
                {shifts.map((shift) => (
                  <ReadOnlyShift key={shift.id} shift={shift} currentUserId={user.id} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}

/**
 * Post / unpost this department's week. Posting asks first (and says how many
 * slots are still open); while posted, a banner explains that edits are live.
 */
function PostControls({
  week,
  weekStart,
  onStatusChange,
}: {
  week: DepartmentWeek
  weekStart: string
  onStatusChange: (status: ScheduleStatus, postedAt: string | null) => void
}) {
  const { t, errorMessage } = useI18n()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const openSlots = week.shifts.reduce((n, s) => n + s.slots.filter((slot) => !slot.user).length, 0)
  const posted = week.status === 'POSTED'

  async function setStatus(status: ScheduleStatus) {
    setError(null)
    setBusy(true)
    try {
      const result = await api<{ status: ScheduleStatus; postedAt: string | null }>(
        `/schedules/${weekStart}/departments/${week.departmentId}`,
        { method: 'PATCH', body: { status } }
      )
      onStatusChange(result.status, result.postedAt)
      setConfirming(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={`mb-4 rounded-2xl p-4 md:max-w-2xl ${
        posted ? 'bg-green-50 text-green-900' : 'bg-white shadow-sm'
      }`}
    >
      {confirming ? (
        <div className="space-y-3">
          <p className="font-medium text-slate-900">{t('schedule.postConfirm')}</p>
          {openSlots > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {openSlots === 1
                ? t('schedule.openSlotsWarningOne')
                : t('schedule.openSlotsWarning', { count: openSlots })}
            </p>
          )}
          <p className="text-sm text-slate-600">{t('schedule.postHint')}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => setStatus('POSTED')} disabled={busy}>
              {busy ? t('common.saving') : t('schedule.post')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{posted ? t('schedule.postedBanner') : t('schedule.draftBanner')}</p>
          <Button
            variant={posted ? 'secondary' : 'primary'}
            className="w-auto! py-2!"
            disabled={busy}
            onClick={() => (posted ? setStatus('DRAFT') : setConfirming(true))}
          >
            {posted ? t('schedule.unpost') : t('schedule.post')}
          </Button>
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    </div>
  )
}

function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    groups.set(item.date, [...(groups.get(item.date) ?? []), item])
  }
  return [...groups.entries()]
}
