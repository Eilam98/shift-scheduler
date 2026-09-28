import type { ReactNode } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { formatWeekRange } from '../lib/dates'
import { ChevronEndIcon, ChevronStartIcon } from './icons'

/** ‹ week range › bar, with an optional status line under the dates. */
export function WeekNav({
  weekStart,
  onPrev,
  onNext,
  children,
}: {
  weekStart: string
  onPrev: () => void
  onNext: () => void
  children?: ReactNode
}) {
  const { t, locale } = useI18n()

  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm md:max-w-md">
      <button
        aria-label={t('schedule.prevWeek')}
        onClick={onPrev}
        className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
      >
        <ChevronStartIcon className="size-5" />
      </button>
      <div className="text-center">
        <p className="font-medium text-slate-900">{formatWeekRange(weekStart, locale)}</p>
        {children}
      </div>
      <button
        aria-label={t('schedule.nextWeek')}
        onClick={onNext}
        className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
      >
        <ChevronEndIcon className="size-5" />
      </button>
    </div>
  )
}
