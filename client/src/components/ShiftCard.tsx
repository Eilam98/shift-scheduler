import { useState } from 'react'
import { api } from '../lib/api'
import type { Member, Shift, Slot } from '../types'
import { ErrorMessage } from './ui'

const LABELS = { MORNING: 'Morning', EVENING: 'Evening' } as const

/**
 * One shift for one department. Managers add/remove slots and pick who fills
 * each; everyone else sees a read-only list of names.
 */
export function ShiftCard({
  shift,
  departmentId,
  canEdit,
  members,
  onSlotsChange,
}: {
  shift: Shift
  departmentId: string
  canEdit: boolean
  members: Member[]
  onSlotsChange: (slots: Slot[]) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<Slot[]>) {
    setError(null)
    setBusy(true)
    try {
      onSlotsChange(await action())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const addSlot = () =>
    run(async () => {
      const slot = await api<Slot>(`/shifts/${shift.id}/slots`, {
        method: 'POST',
        body: { departmentId },
      })
      return [...shift.slots, slot]
    })

  const assign = (slotId: string, userId: string | null) =>
    run(async () => {
      const updated = await api<Slot>(`/slots/${slotId}`, { method: 'PATCH', body: { userId } })
      return shift.slots.map((s) => (s.id === slotId ? updated : s))
    })

  const removeSlot = (slotId: string) =>
    run(async () => {
      await api(`/slots/${slotId}`, { method: 'DELETE' })
      return shift.slots.filter((s) => s.id !== slotId)
    })

  // People already placed in this shift (this department) — can't be picked twice.
  const takenIds = new Set(shift.slots.map((s) => s.user?.id).filter(Boolean))
  const filled = shift.slots.filter((s) => s.user).length

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-slate-900">{LABELS[shift.label]}</p>
        <p className="text-sm text-slate-500">
          {shift.startTime}–{shift.endTime}
          {shift.slots.length > 0 && ` · ${filled}/${shift.slots.length}`}
        </p>
      </div>

      {shift.slots.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">{canEdit ? 'No slots yet' : 'Nobody scheduled'}</p>
      )}

      <ul className="mt-2 space-y-2">
        {shift.slots.map((slot) => (
          <li key={slot.id} className="flex items-center gap-2">
            {canEdit ? (
              <>
                <select
                  aria-label={`${LABELS[shift.label]} slot`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900"
                  value={slot.user?.id ?? ''}
                  disabled={busy}
                  onChange={(e) => assign(slot.id, e.target.value || null)}
                >
                  <option value="">— Empty —</option>
                  {members.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      disabled={takenIds.has(m.id) && slot.user?.id !== m.id}
                    >
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  aria-label="Remove slot"
                  disabled={busy}
                  onClick={() => removeSlot(slot.id)}
                  className="shrink-0 rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  ✕
                </button>
              </>
            ) : (
              <span className={slot.user ? 'text-slate-900' : 'text-slate-400'}>
                {slot.user?.name ?? 'Open slot'}
              </span>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      {canEdit && (
        <button
          disabled={busy}
          onClick={addSlot}
          className="mt-2 text-sm font-medium text-indigo-600 disabled:opacity-60"
        >
          + Add slot
        </button>
      )}
    </div>
  )
}
