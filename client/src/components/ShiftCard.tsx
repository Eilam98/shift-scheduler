import { useState, type DragEvent } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { STATUS_RANK, STATUS_SYMBOL, entryKey } from '../lib/availability'
import { HIGHLIGHT_CLASSES, WORKER_DRAG_TYPE, type Highlight } from '../lib/staffing'
import type { AvailabilityStatus, Member, Shift, Slot, TeamAvailability } from '../types'
import { ErrorMessage } from './ui'

/**
 * One shift for one department, in the editor: add/remove slots and pick who
 * fills each. With a worker selected in the workers panel the card is coloured
 * by their availability, and they can be assigned by dropping their name on it
 * (or on a filled slot, to replace that person) or with the add button.
 */
export function ShiftCard({
  shift,
  departmentId,
  members,
  availability = [],
  selected = null,
  highlight = null,
  pending = false,
  onAssignWorker,
  onSlotsChange,
}: {
  shift: Shift
  departmentId: string
  members: Member[]
  /** Everyone's availability this week — shown next to names, it doesn't block. */
  availability?: TeamAvailability['workers']
  /** The worker selected in the workers panel, and what this shift means for them. */
  selected?: { id: string; name: string } | null
  highlight?: Highlight | null
  /** A panel assignment for this shift is being saved. */
  pending?: boolean
  onAssignWorker?: (userId: string, slotId?: string) => void
  onSlotsChange: (slots: Slot[]) => void
}) {
  const { t, errorMessage, departmentName } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dropTarget, setDropTarget] = useState(false)
  const label = t(`shift.${shift.label}`)
  const disabled = busy || pending

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

  // Drag and drop (desktop): a worker name from the panel.
  const isWorkerDrag = (e: DragEvent) => e.dataTransfer.types.includes(WORKER_DRAG_TYPE)
  function dragOver(e: DragEvent) {
    if (!isWorkerDrag(e) || disabled) return
    e.preventDefault() // allows the drop
    setDropTarget(true)
  }
  function drop(e: DragEvent, slotId?: string) {
    if (!isWorkerDrag(e)) return
    e.preventDefault()
    e.stopPropagation() // a slot drop shouldn't also count as a card drop
    setDropTarget(false)
    const userId = e.dataTransfer.getData(WORKER_DRAG_TYPE)
    if (userId && !disabled) onAssignWorker?.(userId, slotId)
  }

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

  const colour = highlight ? HIGHLIGHT_CLASSES[highlight.kind] : 'border-slate-200'

  return (
    <div
      onDragOver={dragOver}
      onDragLeave={() => setDropTarget(false)}
      onDrop={(e) => drop(e)}
      className={`rounded-xl border-2 p-3 transition-colors ${colour} ${
        dropTarget ? 'outline-2 outline-offset-2 outline-indigo-500 outline-dashed' : ''
      } ${pending ? 'opacity-60' : ''}`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-sm text-slate-500" dir="ltr">
          {shift.startTime}–{shift.endTime}
          {shift.slots.length > 0 && ` · ${filled}/${shift.slots.length}`}
        </p>
      </div>

      {shift.slots.length === 0 && <p className="mt-2 text-sm text-slate-400">{t('shift.noSlots')}</p>}

      <ul className="mt-2 space-y-2">
        {shift.slots.map((slot) => (
          <li key={slot.id} className="flex items-center gap-2" onDragOver={dragOver} onDrop={(e) => drop(e, slot.id)}>
            <select
              aria-label={t('shift.slot', { shift: label })}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-base text-slate-900 2xl:text-sm"
              value={slot.user?.id ?? ''}
              disabled={disabled}
              onChange={(e) => assign(slot.id, e.target.value || null)}
            >
              <option value="">{t('shift.empty')}</option>
              {options.map((m) => (
                <option key={m.id} value={m.id} disabled={takenIds.has(m.id) && slot.user?.id !== m.id}>
                  {STATUS_SYMBOL[m.status]} {m.name}
                  {m.note ? ` — ${m.note}` : ''}
                </option>
              ))}
            </select>
            <button
              aria-label={t('shift.removeSlot')}
              disabled={disabled}
              onClick={() => removeSlot(slot.id)}
              className="shrink-0 rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* With a worker selected: their status here, and a tap-to-add button. */}
      {selected && highlight && (
        <div className="mt-2">
          {highlight.kind === 'HERE' ? (
            <p className="text-xs font-medium text-indigo-700">{t('shift.alreadyHere', { name: selected.name })}</p>
          ) : highlight.kind === 'ELSEWHERE' ? (
            <p className="text-xs font-medium text-sky-800">
              {t('shift.workingIn', { name: selected.name, department: departmentName(highlight.departmentName) })}
            </p>
          ) : (
            <>
              {highlight.note && <p className="mb-1 text-xs text-slate-600">“{highlight.note}”</p>}
              <button
                disabled={disabled}
                onClick={() => onAssignWorker?.(selected.id)}
                className={`w-full rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60 ${
                  highlight.kind === 'UNAVAILABLE'
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {pending ? t('common.saving') : t('shift.addWorker', { name: selected.name })}
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}

      <button
        disabled={disabled}
        onClick={addSlot}
        className="mt-2 text-sm font-medium text-indigo-600 disabled:opacity-60"
      >
        {t('shift.addSlot')}
      </button>
    </div>
  )
}
