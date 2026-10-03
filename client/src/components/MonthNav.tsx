import type { ReactNode } from 'react'
import { useI18n } from '../i18n/i18nContext'
import { addMonths, formatMonth } from '../lib/dates'
import { ChevronEndIcon, ChevronStartIcon } from './icons'

/** ‹ month › bar, with an optional line under the month. */
export function MonthNav({
  month,
  onChange,
  children,
}: {
  month: string
  onChange: (month: string) => void
  children?: ReactNode
}) {
  const { t, locale } = useI18n()
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-white p-2 shadow-sm md:max-w-md">
      <button
        aria-label={t('pay.prevMonth')}
        onClick={() => onChange(addMonths(month, -1))}
        className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
      >
        <ChevronStartIcon className="size-5" />
      </button>
      <div className="text-center">
        <p className="font-medium text-slate-900">{formatMonth(month, locale)}</p>
        {children}
      </div>
      <button
        aria-label={t('pay.nextMonth')}
        onClick={() => onChange(addMonths(month, 1))}
        className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
      >
        <ChevronEndIcon className="size-5" />
      </button>
    </div>
  )
}
