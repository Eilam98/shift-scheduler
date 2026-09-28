import { useState } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { STATUSES, STATUS_CLASSES, STATUS_LABEL, STATUS_SYMBOL, entryKey } from '../lib/availability'
import { formatDay } from '../lib/dates'
import type { AvailabilityEntry, AvailabilityStatus } from '../types'

/**
 * A week's 14 shifts, each with can / prefer not / can't and an optional note.
 * Used for your own week and by managers editing a worker's week.
 */
export function AvailabilityWeekEditor({
  entries,
  onChange,
  readOnly = false,
}: {
  entries: AvailabilityEntry[]
  onChange: (entries: AvailabilityEntry[]) => void
  readOnly?: boolean
}) {
  const { locale } = useI18n()

  function update(key: string, change: Partial<AvailabilityEntry>) {
    onChange(entries.map((e) => (entryKey(e) === key ? { ...e, ...change } : e)))
  }

  const days: [string, AvailabilityEntry[]][] = []
  for (const e of entries) {
    const last = days[days.length - 1]
    if (last?.[0] === e.date) last[1].push(e)
    else days.push([e.date, [e]])
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {days.map(([date, shifts]) => (
        <div key={date} className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 font-semibold text-slate-900">{formatDay(date, locale)}</h3>
          <div className="space-y-3">
            {shifts.map((entry) => (
              <ShiftAvailability
                key={entryKey(entry)}
                entry={entry}
                readOnly={readOnly}
                onChange={(change) => update(entryKey(entry), change)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ShiftAvailability({
  entry,
  readOnly,
  onChange,
}: {
  entry: AvailabilityEntry
  readOnly: boolean
  onChange: (change: Partial<AvailabilityEntry>) => void
}) {
  const { t } = useI18n()
  const [noteOpen, setNoteOpen] = useState(false)
  const shiftName = t(`shift.${entry.label}`)

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{shiftName}</span>
        <div role="radiogroup" aria-label={shiftName} className="flex gap-1">
          {STATUSES.map((status: AvailabilityStatus) => {
            const selected = entry.status === status
            return (
              <button
                key={status}
                role="radio"
                aria-checked={selected}
                disabled={readOnly}
                onClick={() => onChange({ status })}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium ${
                  selected
                    ? `${STATUS_CLASSES[status]} ring-1 ring-current`
                    : 'text-slate-500 hover:bg-slate-100'
                } disabled:cursor-default ${readOnly && !selected ? 'opacity-40' : ''}`}
              >
                <span aria-hidden="true">{STATUS_SYMBOL[status]} </span>
                {t(STATUS_LABEL[status])}
              </button>
            )
          })}
        </div>
      </div>
      {readOnly ? (
        entry.note && <p className="mt-1 text-sm text-slate-600">“{entry.note}”</p>
      ) : noteOpen || entry.note ? (
        <input
          aria-label={t('availability.note')}
          placeholder={t('availability.notePlaceholder')}
          maxLength={200}
          value={entry.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
      ) : (
        <button onClick={() => setNoteOpen(true)} className="mt-1 text-xs font-medium text-indigo-600">
          {t('availability.addNote')}
        </button>
      )}
    </div>
  )
}
