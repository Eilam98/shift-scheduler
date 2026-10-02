import { useI18n } from '../i18n/i18nContext'
import { STATUS_LABEL } from '../lib/availability'
import { HIGHLIGHT_CLASSES, WORKER_DRAG_TYPE } from '../lib/staffing'
import type { TeamAvailability } from '../types'

/**
 * The schedule editor's workers panel: the department's workers with their
 * shifts this week and whether they submitted availability. Click a name to
 * colour the week by their availability; drag it onto a shift (desktop) or use
 * the shift's add button to assign them.
 */
export function StaffingPanel({
  workers,
  counts,
  selectedId,
  onSelect,
}: {
  workers: TeamAvailability['workers']
  counts: Map<string, number>
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  const { t } = useI18n()

  function countLabel(count: number) {
    if (count === 0) return t('staffing.shiftsNone')
    if (count === 1) return t('staffing.shiftsOne')
    return t('staffing.shiftsCount', { count })
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-slate-900">{t('staffing.title')}</h2>
      <p className="mt-1 text-xs text-slate-500">{t('staffing.hint')}</p>

      {workers.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('availability.noWorkers')}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
          {workers.map((w) => {
            const selected = w.id === selectedId
            return (
              <li key={w.id}>
                <button
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(WORKER_DRAG_TYPE, w.id)
                    e.dataTransfer.effectAllowed = 'copy'
                    onSelect(w.id) // show their colours while dragging
                  }}
                  onClick={() => onSelect(selected ? null : w.id)}
                  aria-pressed={selected}
                  className={`flex w-full cursor-grab items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start text-sm active:cursor-grabbing lg:gap-3 lg:px-3 lg:py-2 ${
                    selected ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-medium">
                    {w.name}
                    {!w.submitted && (
                      <span
                        title={t('staffing.notSubmitted')}
                        className={`ms-1.5 inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${
                          selected ? 'bg-amber-300 text-amber-900' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        ?
                      </span>
                    )}
                  </span>
                  {/* Phone: just the number, so several names fit per row; wide screens: in words */}
                  <span
                    title={countLabel(counts.get(w.id) ?? 0)}
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs font-semibold lg:hidden ${
                      selected ? 'bg-white/20' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {counts.get(w.id) ?? 0}
                  </span>
                  <span className={`hidden text-xs lg:inline ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>
                    {countLabel(counts.get(w.id) ?? 0)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* What the colours on the shifts mean */}
      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {(['AVAILABLE', 'PREFER_NOT', 'UNAVAILABLE'] as const).map((k) => (
          <span key={k} className={`rounded-full border px-2 py-0.5 ${HIGHLIGHT_CLASSES[k]}`}>
            {t(STATUS_LABEL[k])}
          </span>
        ))}
        <span className={`rounded-full border px-2 py-0.5 ${HIGHLIGHT_CLASSES.ELSEWHERE}`}>{t('staffing.elsewhere')}</span>
        <span className="rounded-full border border-slate-200 px-2 py-0.5">{t('availability.NONE')}</span>
      </div>
    </div>
  )
}
