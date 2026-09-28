import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ChevronEndIcon, ChevronStartIcon } from '../components/icons'
import { ShiftCard } from '../components/ShiftCard'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { ApiError, api } from '../lib/api'
import { addDays, currentWeekStart, formatDay, formatWeekRange, isWeekStart } from '../lib/dates'
import type { Department, DepartmentWeek, Member, Slot } from '../types'

type Loaded =
  | { kind: 'ready'; week: DepartmentWeek; members: Member[] }
  | { kind: 'missing' } // no schedule created for this week yet
  | { kind: 'error'; message: string }

/**
 * /schedule/:departmentId?week=YYYY-MM-DD — one department's week.
 * Without a departmentId it opens the department you manage (the restaurant
 * manager gets the first department and a switcher for all of them).
 */
export function SchedulePage() {
  const { departmentId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { t, locale, errorMessage, departmentName } = useI18n()
  const weekParam = searchParams.get('week')
  const weekStart = isWeekStart(weekParam) ? weekParam : currentWeekStart()
  const isRestaurantManager = !!user?.isRestaurantManager

  const [reloads, setReloads] = useState(0)
  const key = `${departmentId}/${weekStart}/${reloads}`
  const [result, setResult] = useState<{ key: string; data: Loaded } | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [allDepartments, setAllDepartments] = useState<Department[] | null>(null)

  const canManage =
    !!user && (user.isRestaurantManager || user.managedDepartment?.departmentId === departmentId)

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
    const target = user.managedDepartment?.departmentId ?? allDepartments?.[0]?.id
    if (target) return <Navigate to={`/schedule/${target}?week=${weekStart}`} replace />
    if (!isRestaurantManager) return <Navigate to="/" replace />
    return (
      <Screen>
        <p className="text-slate-500">{t('common.loading')}</p>
      </Screen>
    ) // restaurant manager: waiting for the department list
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

  function updateSlots(shiftId: string, slots: Slot[]) {
    setResult((prev) =>
      prev && prev.data.kind === 'ready'
        ? {
            ...prev,
            data: {
              ...prev.data,
              week: {
                ...prev.data.week,
                shifts: prev.data.week.shifts.map((s) => (s.id === shiftId ? { ...s, slots } : s)),
              },
            },
          }
        : prev
    )
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
          {week && (
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

      {loaded?.kind === 'missing' && (
        <Card className="md:max-w-md">
          <p className="text-slate-700">{t('schedule.noWeek')}</p>
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

      {/* Phone: one day per row. Desktop: a grid, up to the full 7-day week. */}
      {week && loaded?.kind === 'ready' && (
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
                    canEdit={week.canEdit}
                    members={loaded.members}
                    onSlotsChange={(slots) => updateSlots(shift.id, slots)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  )
}

function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    groups.set(item.date, [...(groups.get(item.date) ?? []), item])
  }
  return [...groups.entries()]
}
