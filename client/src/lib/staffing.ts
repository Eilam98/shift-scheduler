import { entryKey } from './availability'
import type { AvailabilityStatus, DepartmentWeek, Shift, TeamAvailability } from '../types'

// The schedule editor's workers panel: what a shift means for the selected
// worker, and how to colour it.

export type Highlight =
  | { kind: AvailabilityStatus | 'NONE'; note: string | null } // their availability ("NONE" = no answer)
  | { kind: 'ELSEWHERE'; departmentName: string } // already working this shift in another department
  | { kind: 'HERE' } // already in one of this shift's slots here

/** Drag-and-drop payload type for a worker id (desktop). */
export const WORKER_DRAG_TYPE = 'application/x-shift-worker'

export function highlightFor(
  workerId: string,
  shift: Shift,
  availability: TeamAvailability['workers'],
  elsewhere: DepartmentWeek['elsewhere']
): Highlight {
  if (shift.slots.some((s) => s.user?.id === workerId)) return { kind: 'HERE' }
  const other = elsewhere.find((e) => e.userId === workerId && e.shiftId === shift.id)
  if (other) return { kind: 'ELSEWHERE', departmentName: other.departmentName }
  const worker = availability.find((w) => w.id === workerId)
  const entry = worker?.submitted ? worker.entries.find((e) => entryKey(e) === entryKey(shift)) : undefined
  return entry ? { kind: entry.status, note: entry.note } : { kind: 'NONE', note: null }
}

/** Shift card colours; blue (another department) wins over availability. */
export const HIGHLIGHT_CLASSES: Record<Highlight['kind'], string> = {
  AVAILABLE: 'border-green-400 bg-green-50',
  PREFER_NOT: 'border-amber-400 bg-amber-50',
  UNAVAILABLE: 'border-red-400 bg-red-50',
  ELSEWHERE: 'border-sky-500 bg-sky-50',
  HERE: 'border-indigo-500 ring-2 ring-indigo-200',
  NONE: 'border-slate-200',
}

/** How many shifts each worker has this week: this department's slots + other departments'. */
export function shiftCounts(week: DepartmentWeek): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1)
  for (const shift of week.shifts) for (const slot of shift.slots) if (slot.user) add(slot.user.id)
  for (const other of week.elsewhere) add(other.userId)
  return counts
}
