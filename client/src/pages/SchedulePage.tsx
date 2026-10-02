import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ReadOnlyShift } from '../components/ReadOnlyShift'
import { ShiftCard } from '../components/ShiftCard'
import { StaffingPanel } from '../components/StaffingPanel'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { WeekNav } from '../components/WeekNav'
import { useI18n } from '../i18n/i18nContext'
import { ApiError, api } from '../lib/api'
import { STATUS_CLASSES, STATUS_LABEL, STATUS_SYMBOL } from '../lib/availability'
import { addDays, currentWeekStart, formatDay, isWeekStart } from '../lib/dates'
import { highlightFor, shiftCounts } from '../lib/staffing'
import type { Department, DepartmentWeek, Member, ScheduleStatus, Shift, Slot, TeamAvailability } from '../types'

type Loaded =
  | { kind: 'ready'; week: DepartmentWeek; members: Member[]; availability: TeamAvailability['workers'] }
  | { kind: 'missing' } // no schedule created for this week yet
  | { kind: 'notPosted' } // exists, but this department hasn't posted it (viewers only)
  | { kind: 'error'; message: string }

/**
 * /schedule/:departmentId?week=YYYY-MM-DD — one department's week, for
 * everyone. Managers of the department (and the restaurant manager) edit and
 * post it, with the workers panel (availability colours, drag / tap to assign);
 * department and shift managers can read drafts; everyone else sees it
 * read-only once it's posted (Team schedule).
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
  // Workers panel: the selected worker (tied to this department + week), the shift
  // being saved, and the last assignment problem.
  const [selection, setSelection] = useState<{ key: string; id: string } | null>(null)
  const [pendingShiftId, setPendingShiftId] = useState<string | null>(null)
  const [staffError, setStaffError] = useState<string | null>(null)

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
        if (!week.canEdit) return { kind: 'ready', week, members: [], availability: [] }
        // Editors also get everyone's availability for this week, shown next to names.
        const [{ members }, team] = await Promise.all([
          api<{ members: Member[] }>(`/departments/${departmentId}/members`),
          api<TeamAvailability>(`/availability/team?week=${weekStart}&departmentId=${departmentId}`),
        ])
        return { kind: 'ready', week, members, availability: team.workers }
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
  const team = loaded?.kind === 'ready' ? loaded.availability : []
  const pageKey = `${departmentId}/${weekStart}`
  const selectedId = selection?.key === pageKey ? selection.id : null
  const selectedWorker = team.find((w) => w.id === selectedId) ?? null
  const counts = week?.canEdit ? shiftCounts(week) : new Map<string, number>()

  function selectWorker(id: string | null) {
    setStaffError(null)
    setSelection(id ? { key: pageKey, id } : null)
  }

  /**
   * Put a worker on a shift from the panel (drag or the add button): into the
   * given slot, else the first empty one, else a new slot. "Can't" asks first;
   * already here / working this shift elsewhere is refused (one slot per shift).
   */
  async function assignWorker(shift: Shift, userId: string, slotId?: string) {
    if (!week) return
    setStaffError(null)
    const name = team.find((w) => w.id === userId)?.name ?? ''
    const status = highlightFor(userId, shift, team, week.elsewhere)
    if (status.kind === 'HERE') return setStaffError(t('schedule.alreadyInShift', { name }))
    if (status.kind === 'ELSEWHERE') {
      return setStaffError(
        t('schedule.workingElsewhere', { name, department: departmentName(status.departmentName) })
      )
    }
    if (status.kind === 'UNAVAILABLE' && !window.confirm(t('schedule.confirmUnavailable', { name }))) return

    setPendingShiftId(shift.id)
    try {
      let slots = shift.slots
      let target = slotId ?? slots.find((s) => !s.user)?.id
      if (!target) {
        const created = await api<Slot>(`/shifts/${shift.id}/slots`, { method: 'POST', body: { departmentId } })
        slots = [...slots, created]
        updateSlots(shift.id, slots)
        target = created.id
      }
      const updated = await api<Slot>(`/slots/${target}`, { method: 'PATCH', body: { userId } })
      updateSlots(shift.id, slots.map((s) => (s.id === target ? updated : s)))
    } catch (err) {
      setStaffError(errorMessage(err))
    } finally {
      setPendingShiftId(null)
    }
  }

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

      <WeekNav weekStart={weekStart} onPrev={() => goToWeek(-7)} onNext={() => goToWeek(7)}>
        {week && (week.canEdit || week.status === 'DRAFT') && (
          <p
            className={`text-xs font-semibold tracking-wide uppercase ${
              week.status === 'POSTED' ? 'text-green-700' : 'text-amber-600'
            }`}
          >
            {week.status === 'POSTED' ? t('schedule.posted') : t('schedule.draft')}
          </p>
        )}
      </WeekNav>

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

      {/* Editor. Phone: the workers panel under the post box, then one day per row.
          Wide screens: the panel beside the week grid, sticky while scrolling. */}
      {week && loaded?.kind === 'ready' && week.canEdit && (
        <div className="lg:flex lg:items-start lg:gap-4">
          <aside className="mb-4 lg:sticky lg:top-16 lg:mb-0 lg:max-h-[calc(100dvh-5rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto">
            <StaffingPanel workers={team} counts={counts} selectedId={selectedId} onSelect={selectWorker} />
          </aside>

          <div className="min-w-0 flex-1">
            {staffError && (
              <div className="mb-3">
                <ErrorMessage>{staffError}</ErrorMessage>
              </div>
            )}
            {selectedWorker && (
              <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
                {t('staffing.selected', { name: selectedWorker.name })}{' '}
                <button onClick={() => selectWorker(null)} className="ms-2 font-medium underline">
                  {t('staffing.clear')}
                </button>
              </p>
            )}
            <AvailabilityLegend />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {days.map(([date, shifts]) => (
                <Card key={date} className="p-4 2xl:p-3">
                  <h2 className="mb-3 font-semibold text-slate-900">{formatDay(date, locale)}</h2>
                  <div className="space-y-2">
                    {shifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        departmentId={departmentId}
                        members={loaded.members}
                        availability={team}
                        selected={selectedWorker && { id: selectedWorker.id, name: selectedWorker.name }}
                        highlight={selectedId ? highlightFor(selectedId, shift, team, week.elsewhere) : null}
                        pending={pendingShiftId === shift.id}
                        onAssignWorker={(userId, slotId) => assignWorker(shift, userId, slotId)}
                        onSlotsChange={(slots) => updateSlots(shift.id, slots)}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
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

/** What ✓ ~ ? ✗ next to names mean. */
function AvailabilityLegend() {
  const { t } = useI18n()
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span>{t('availability.legend')}</span>
      {(['AVAILABLE', 'PREFER_NOT', 'NONE', 'UNAVAILABLE'] as const).map((s) => (
        <span key={s} className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLASSES[s]}`}>
          {STATUS_SYMBOL[s]} {t(STATUS_LABEL[s])}
        </span>
      ))}
    </div>
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
