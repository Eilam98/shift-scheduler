import { Link } from 'react-router'
import { useI18n } from '../i18n/i18nContext'
import { formatDay } from '../lib/dates'
import type { MyShift } from '../types'
import { ChevronEndIcon } from './icons'

/** One of my shifts; links to that department's week. */
export function MyShiftRow({ shift, muted = false }: { shift: MyShift; muted?: boolean }) {
  const { t, locale, departmentName } = useI18n()

  return (
    <Link
      to={`/schedule/${shift.department.id}?week=${shift.weekStartDate}`}
      className={`flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50 ${
        muted ? 'opacity-70' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{formatDay(shift.date, locale)}</p>
        <p className="text-sm text-slate-600">
          {t(`shift.${shift.label}`)} ·{' '}
          <span dir="ltr">
            {shift.startTime}–{shift.endTime}
          </span>{' '}
          · {departmentName(shift.department.name)}
        </p>
      </div>
      <ChevronEndIcon className="size-5 shrink-0 text-slate-400" />
    </Link>
  )
}
