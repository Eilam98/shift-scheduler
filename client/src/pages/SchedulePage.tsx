import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../auth/authContext'
import { ShiftCard } from '../components/ShiftCard'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { ApiError, api } from '../lib/api'
import { addDays, currentWeekStart, formatDay, formatWeekRange, isWeekStart } from '../lib/dates'
import type { DepartmentWeek, Member, Slot } from '../types'

type Loaded =
  | { kind: 'ready'; week: DepartmentWeek; members: Member[] }
  | { kind: 'missing' } // no schedule created for this week yet
  | { kind: 'error'; message: string }

/** /schedule/:departmentId?week=YYYY-MM-DD — one department's week. */
export function SchedulePage() {
  const { departmentId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const weekParam = searchParams.get('week')
  const weekStart = isWeekStart(weekParam) ? weekParam : currentWeekStart()

  const [reloads, setReloads] = useState(0)
  const key = `${departmentId}/${weekStart}/${reloads}`
  const [result, setResult] = useState<{ key: string; data: Loaded } | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const canManage =
    !!user &&
    (user.isRestaurantManager ||
      user.departments.some((d) => d.departmentId === departmentId && d.isManager))

  useEffect(() => {
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
        return { kind: 'error', message: err instanceof Error ? err.message : 'Could not load' }
      }
    })().then((data) => {
      if (!cancelled) setResult({ key, data })
    })
    return () => {
      cancelled = true
    }
  }, [departmentId, weekStart, key])

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
      setCreateError(err instanceof Error ? err.message : 'Could not create the week')
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
    <Screen>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          {week ? `${week.departmentName} schedule` : 'Schedule'}
        </h1>
        <Link to="/" className="text-sm font-medium text-indigo-600">
          ← Home
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm">
        <button
          aria-label="Previous week"
          onClick={() => goToWeek(-7)}
          className="rounded-lg px-4 py-2 text-lg text-slate-600 hover:bg-slate-100"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="font-medium text-slate-900">{formatWeekRange(weekStart)}</p>
          {week && (
            <p
              className={`text-xs font-semibold tracking-wide uppercase ${
                week.status === 'POSTED' ? 'text-green-700' : 'text-amber-600'
              }`}
            >
              {week.status === 'POSTED' ? 'Posted' : 'Draft'}
            </p>
          )}
        </div>
        <button
          aria-label="Next week"
          onClick={() => goToWeek(7)}
          className="rounded-lg px-4 py-2 text-lg text-slate-600 hover:bg-slate-100"
        >
          ›
        </button>
      </div>

      {!loaded && <p className="text-slate-500">Loading…</p>}

      {loaded?.kind === 'error' && <ErrorMessage>{loaded.message}</ErrorMessage>}

      {loaded?.kind === 'missing' && (
        <Card>
          <p className="text-slate-700">No schedule for this week yet.</p>
          {canManage && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">
                Creating it adds a morning and evening shift for every day, using the default
                shift times.
              </p>
              {createError && <ErrorMessage>{createError}</ErrorMessage>}
              <Button onClick={createWeek} disabled={creating}>
                {creating ? 'Creating…' : 'Create this week'}
              </Button>
            </div>
          )}
        </Card>
      )}

      {week && loaded?.kind === 'ready' && (
        <div className="space-y-3">
          {days.map(([date, shifts]) => (
            <Card key={date}>
              <h2 className="mb-3 font-semibold text-slate-900">{formatDay(date)}</h2>
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
