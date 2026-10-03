import { useI18n } from '../i18n/i18nContext'
import { formatDay } from '../lib/dates'
import { formatShekels } from '../lib/money'
import { formatHours } from '../lib/tips'
import type { PayrollWorker } from '../types'

/** Each day's hours and amount (fixed pay or tip share). */
export function PayDayList({ worker }: { worker: PayrollWorker }) {
  const { t, locale, departmentName } = useI18n()
  const name = (id: string) => departmentName(worker.departments.find((d) => d.departmentId === id)?.departmentName ?? '')
  return (
    <ul className="mt-3 divide-y divide-slate-100 rounded-lg bg-white text-xs">
      {worker.days.map((day) => (
        <li key={day.entryId} className="flex items-center justify-between gap-3 px-3 py-2">
          <span>
            {formatDay(day.date, locale)}
            {day.label && ` · ${t(`shift.${day.label}`)}`} · {name(day.departmentId)}
          </span>
          <span className="flex gap-3 tabular-nums">
            <span dir="ltr">{formatHours(day.minutes)}</span>
            <span className="w-20 text-end font-medium">{formatShekels(day.amount, locale)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
