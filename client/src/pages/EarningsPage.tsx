import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { MonthNav } from '../components/MonthNav'
import { PayDayList } from '../components/PayDayList'
import { Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { currentMonth, formatDay, isMonth } from '../lib/dates'
import { formatShekels } from '../lib/money'
import { formatHours } from '../lib/tips'
import type { MyEarnings } from '../types'

/**
 * /earnings?month=YYYY-MM — my hours and earnings for a month, per department
 * and per day. The current month is an estimate (the top-up is settled at
 * month end). Same calculation as the payroll report.
 */
export function EarningsPage() {
  const { t, locale, errorMessage, departmentName } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const monthParam = searchParams.get('month')
  const month = isMonth(monthParam) ? monthParam : currentMonth()
  const [data, setData] = useState<MyEarnings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<MyEarnings>(`/payroll/me?month=${month}`)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [month, errorMessage])

  const current = data?.month === month ? data : null
  const me = current?.me
  const money = (agorot: number) => formatShekels(agorot, locale)

  return (
    <Screen title={t('earnings.title')}>
      <MonthNav month={month} onChange={(m) => setSearchParams({ month: m })}>
        {current?.isCurrentMonth && <p className="text-xs font-semibold text-amber-700">{t('earnings.estimate')}</p>}
      </MonthNav>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!current && !error && <p className="text-slate-500">{t('common.loading')}</p>}
      {current && (
        <div className="space-y-4">
          {current.warnings.length > 0 && (
            <Card className="border border-amber-200 bg-amber-50! p-4 text-sm text-amber-900">
              <p className="font-semibold">{t('earnings.needsFixing')}</p>
              <ul className="mt-1 list-inside list-disc">
                {current.warnings.map((w, i) => (
                  <li key={i}>{'date' in w ? t(`earnings.warn.${w.kind}`, { date: formatDay(w.date, locale) }) : null}</li>
                ))}
              </ul>
            </Card>
          )}

          {!me ? (
            <Card>
              <p className="text-slate-500">{t('earnings.nothing')}</p>
            </Card>
          ) : (
            <>
              <Card className="p-5">
                <p className="text-sm text-slate-500">{current.isCurrentMonth ? t('earnings.soFar') : t('earnings.totalFor')}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums">{money(me.total)}</p>
                <p className="mt-1 text-sm text-slate-600" dir="ltr">
                  {formatHours(me.minutes)} {t('report.hoursShort')}
                </p>
                {current.isCurrentMonth && <p className="mt-2 text-xs text-slate-500">{t('earnings.estimateHint')}</p>}
              </Card>

              <div className="grid gap-3 md:grid-cols-2">
                {me.departments.map((d) => (
                  <Card key={d.departmentId} className="p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold text-slate-900">{departmentName(d.departmentName)}</p>
                      <p className="text-sm text-slate-500" dir="ltr">
                        {formatHours(d.minutes)} {t('report.hoursShort')}
                      </p>
                    </div>
                    <dl className="mt-2 space-y-1 text-sm">
                      {d.payType === 'FIXED' ? (
                        <Line label={t('pay.fixedPay')} value={money(d.fixedPay)} />
                      ) : (
                        <>
                          <Line label={t('pay.tips')} value={money(d.tipShares)} />
                          {d.minimumOwed > 0 && <Line label={t('pay.topUp')} value={money(d.topUp)} hint={t('earnings.topUpHint', { amount: money(d.minimumOwed) })} />}
                        </>
                      )}
                      {d.bonus > 0 && <Line label={t('pay.bonus')} value={money(d.bonus)} />}
                      <div className="flex justify-between border-t border-slate-100 pt-1 font-semibold">
                        <dt>{t('pay.total')}</dt>
                        <dd className="tabular-nums">{money(d.total)}</dd>
                      </div>
                    </dl>
                  </Card>
                ))}
              </div>

              <Card className="p-4">
                <h2 className="font-semibold text-slate-900">{t('earnings.days')}</h2>
                <PayDayList worker={me} />
              </Card>
              <p className="text-xs text-slate-500">{t('pay.notIncluded')}</p>
            </>
          )}
        </div>
      )}
    </Screen>
  )
}

function Line({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="flex justify-between">
        <dt className="text-slate-600">{label}</dt>
        <dd className="tabular-nums">{value}</dd>
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
}
