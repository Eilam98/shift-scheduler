import { useState } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { STATUS_RANK, STATUS_SYMBOL, entryKey } from '../lib/availability'
import type { AvailabilityStatus, Member, Shift, Slot, TeamAvailability } from '../types'
import { ErrorMessage } from './ui'

/**
 * One shift for one department. Managers add/remove slots and pick who fills
 * each; everyone else sees a read-only list of names.
 */
export function ShiftCard({
  shift,
  departmentId,
  canEdit,
  members,
  availability = [],
  onSlotsChange,
}: {
  shift: Shift
  departmentId: string
  canEdit: boolean
  members: Member[]
  /** Everyone's availability this week (editors) — shown next to names, it doesn't block. */
  availability?: TeamAvailability['workers']
  onSlotsChange: (slots: Slot[]) => void
}) {
  const { t, errorMessage } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const label = t(`shift.${shift.label}`)

  async function run(action: () => Promise<Slot[]>) {
    setError(null)
    setBusy(true)
    try {
      onSlotsChange(await action())
    } catch (err) {
      setError(errorMessage(err))
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

  // Each member's answer for THIS shift; "NONE" = didn't submit the week.
  const answerFor = (userId: string): { status: AvailabilityStatus | 'NONE'; note: string | null } => {
    const worker = availability.find((w) => w.id === userId)
    const entry = worker?.submitted ? worker.entries.find((e) => entryKey(e) === entryKey(shift)) : undefined
    return entry ? { status: entry.status, note: entry.note } : { status: 'NONE', note: null }
  }
  const options = members
    .map((m) => ({ ...m, ...answerFor(m.id) }))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name))

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-sm text-slate-500" dir="ltr">
          {shift.startTime}–{shift.endTime}
          {shift.slots.length > 0 && ` · ${filled}/${shift.slots.length}`}
        </p>
      </div>

      {shift.slots.length === 0 && (
        <p className="mt-2 text-sm text-slate-400">{canEdit ? t('shift.noSlots') : t('shift.nobody')}</p>
      )}

      <ul className="mt-2 space-y-2">
        {shift.slots.map((slot) => (
          <li key={slot.id} className="flex items-center gap-2">
            {canEdit ? (
              <>
                <select
                  aria-label={t('shift.slot', { shift: label })}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900 2xl:text-sm"
                  value={slot.user?.id ?? ''}
                  disabled={busy}
                  onChange={(e) => assign(slot.id, e.target.value || null)}
                >
                  <option value="">{t('shift.empty')}</option>
                  {options.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                      disabled={takenIds.has(m.id) && slot.user?.id !== m.id}
                    >
                      {STATUS_SYMBOL[m.status]} {m.name}
                      {m.note ? ` — ${m.note}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  aria-label={t('shift.removeSlot')}
                  disabled={busy}
                  onClick={() => removeSlot(slot.id)}
                  className="shrink-0 rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  ✕
                </button>
              </>
            ) : (
              <span className={slot.user ? 'text-slate-900' : 'text-slate-400'}>
                {slot.user?.name ?? t('shift.open')}
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
          {t('shift.addSlot')}
        </button>
      )}
    </div>
  )
}
