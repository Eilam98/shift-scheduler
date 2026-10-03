import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MonthNav } from '../components/MonthNav'
import { PayDayList } from '../components/PayDayList'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { currentMonth, formatDay, isMonth, weekStartOf } from '../lib/dates'
import { agorotToInput, formatShekels, parseShekels } from '../lib/money'
import { formatHours } from '../lib/tips'
import type { DepartmentRates, PayType, Payroll, PayrollWarning, PayrollWorker } from '../types'

const inputClass = 'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900'

/**
 * /payroll?tab=report|rates&month=YYYY-MM — restaurant manager only.
 * "Payroll report": everyone's pay for a month, warnings, CSV export.
 * "Departments & pay": each department's pay type and rate history.
 */
export function PayrollPage() {
  const { t } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'rates' ? 'rates' : 'report'
  const monthParam = searchParams.get('month')
  const month = isMonth(monthParam) ? monthParam : currentMonth()

  return (
    <Screen wide title={t('pay.title')}>
      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-white p-1 shadow-sm">
        {(['report', 'rates'] as const).map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            onClick={() => setSearchParams({ tab: tb, month })}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === tb ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tb === 'report' ? t('pay.reportTab') : t('pay.ratesTab')}
          </button>
        ))}
      </div>
      {tab === 'report' ? (
        <PayrollReport month={month} onMonth={(m) => setSearchParams({ tab, month: m })} onFixRates={() => setSearchParams({ tab: 'rates', month })} />
      ) : (
        <DepartmentsPay />
      )}
    </Screen>
  )
}

function PayrollReport({ month, onMonth, onFixRates }: { month: string; onMonth: (m: string) => void; onFixRates: () => void }) {
  const { t, locale, errorMessage, departmentName } = useI18n()
  const [data, setData] = useState<{ key: string; payroll: Payroll } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<Payroll>(`/payroll?month=${month}`)
      .then((payroll) => {
        if (!cancelled) {
          setData({ key: month, payroll })
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

  const payroll = data?.key === month ? data.payroll : null
  const money = (agorot: number) => formatShekels(agorot, locale)

  function exportCsv() {
    if (!payroll) return
    const amount = (agorot: number) => (agorot / 100).toFixed(2) // plain numbers so Excel can add them up
    const header = [t('pay.worker'), t('pay.departments'), t('pay.hours'), t('pay.fixedPay'), t('pay.tips'), t('pay.topUp'), t('pay.bonus'), t('pay.total')]
    const rows = payroll.workers.map((w) => [
      w.name,
      w.departments.map((d) => departmentName(d.departmentName)).join(' + '),
      (w.minutes / 60).toFixed(2),
      amount(w.fixedPay),
      amount(w.tipShares),
      amount(w.topUp),
      amount(w.bonus),
      amount(w.total),
    ])
    const totals = payroll.totals
    rows.push([t('pay.totalRow'), '', (totals.minutes / 60).toFixed(2), amount(totals.fixedPay), amount(totals.tipShares), amount(totals.topUp), amount(totals.bonus), amount(totals.total)])
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    // A leading byte-order mark tells Excel the file is UTF-8, so Hebrew shows correctly.
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `payroll-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <MonthNav month={month} onChange={onMonth}>
        {payroll?.isCurrentMonth && <p className="text-xs font-semibold text-amber-700">{t('pay.inProgress')}</p>}
      </MonthNav>
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {!payroll && !error && <p className="text-slate-500">{t('common.loading')}</p>}
      {payroll && (
        <div className="space-y-4">
          <Warnings warnings={payroll.warnings} onFixRates={onFixRates} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{t('pay.notIncluded')}</p>
            <Button variant="secondary" className="w-auto! py-2!" onClick={exportCsv} disabled={payroll.workers.length === 0}>
              {t('pay.exportCsv')}
            </Button>
          </div>

          {payroll.workers.length === 0 ? (
            <Card>
              <p className="text-slate-500">{t('pay.noHours')}</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="p-3 text-start font-medium">{t('pay.worker')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.hours')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.fixedPay')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.tips')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.topUp')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.bonus')}</th>
                    <th className="p-3 text-end font-medium">{t('pay.total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.workers.map((w) => (
                    <WorkerRows key={w.userId} worker={w} open={openId === w.userId} onToggle={() => setOpenId(openId === w.userId ? null : w.userId)} />
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-semibold">
                  <tr>
                    <td className="p-3">{t('pay.totalRow')}</td>
                    <td className="p-3 text-end tabular-nums" dir="ltr">{formatHours(payroll.totals.minutes)}</td>
                    <td className="p-3 text-end tabular-nums">{money(payroll.totals.fixedPay)}</td>
                    <td className="p-3 text-end tabular-nums">{money(payroll.totals.tipShares)}</td>
                    <td className="p-3 text-end tabular-nums">{money(payroll.totals.topUp)}</td>
                    <td className="p-3 text-end tabular-nums">{money(payroll.totals.bonus)}</td>
                    <td className="p-3 text-end tabular-nums">{money(payroll.totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One worker in the payroll table; opens to show departments and days. */
function WorkerRows({ worker: w, open, onToggle }: { worker: PayrollWorker; open: boolean; onToggle: () => void }) {
  const { t, locale, departmentName } = useI18n()
  const money = (agorot: number) => formatShekels(agorot, locale)
  return (
    <>
      <tr className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={onToggle} aria-expanded={open}>
        <td className="p-3 font-medium text-slate-900">{w.name}</td>
        <td className="p-3 text-end tabular-nums" dir="ltr">{formatHours(w.minutes)}</td>
        <td className="p-3 text-end tabular-nums">{money(w.fixedPay)}</td>
        <td className="p-3 text-end tabular-nums">{money(w.tipShares)}</td>
        <td className="p-3 text-end tabular-nums">{money(w.topUp)}</td>
        <td className="p-3 text-end tabular-nums">{money(w.bonus)}</td>
        <td className="p-3 text-end font-semibold tabular-nums">{money(w.total)}</td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={7} className="p-3">
            <div className="grid gap-3 md:grid-cols-2">
              {w.departments.map((d) => (
                <div key={d.departmentId} className="rounded-lg bg-white p-3 text-xs">
                  <p className="mb-1 font-semibold text-slate-900">
                    {departmentName(d.departmentName)} · {d.payType === 'TIPS' ? t('pay.typeTips') : t('pay.typeFixed')}
                  </p>
                  <p dir="ltr" className="text-start">{formatHours(d.minutes)} {t('report.hoursShort')}</p>
                  {d.payType === 'TIPS' ? (
                    <p>
                      {t('pay.tips')}: {money(d.tipShares)} · {t('pay.minimumOwed')}: {money(d.minimumOwed)} · {t('pay.topUp')}: {money(d.topUp)}
                    </p>
                  ) : (
                    <p>{t('pay.fixedPay')}: {money(d.fixedPay)}</p>
                  )}
                  {d.bonusRate > 0 && <p>{t('pay.bonus')}: {money(d.bonus)} ({t('pay.perHour', { amount: money(d.bonusRate) })})</p>}
                </div>
              ))}
            </div>
            <PayDayList worker={w} />
          </td>
        </tr>
      )}
    </>
  )
}

/** What needs fixing before paying, with links to the page that fixes it. */
function Warnings({ warnings, onFixRates }: { warnings: PayrollWarning[]; onFixRates: () => void }) {
  const { t, locale, departmentName } = useI18n()
  if (warnings.length === 0) return null
  return (
    <Card className="border border-amber-200 bg-amber-50! p-4">
      <h2 className="font-semibold text-amber-900">{t('pay.warningsTitle', { count: warnings.length })}</h2>
      <ul className="mt-2 space-y-1 text-sm text-amber-900">
        {warnings.map((w, i) =>
          w.kind === 'NO_RATE' ? (
            <li key={i}>
              {t('pay.warn.NO_RATE', { department: departmentName(w.departmentName) })}{' '}
              <button onClick={onFixRates} className="font-medium underline">
                {t('pay.setRate')}
              </button>
            </li>
          ) : (
            <li key={i}>
              {t(`pay.warn.${w.kind}`, { name: w.name, date: formatDay(w.date, locale) })}{' '}
              <Link to={`/attendance?week=${weekStartOf(w.date)}`} className="font-medium underline">
                {t('pay.fixInAttendance')}
              </Link>
            </li>
          )
        )}
      </ul>
    </Card>
  )
}

/** Departments & pay: current rate + history per department, add a rate from a date. */
function DepartmentsPay() {
  const { t, errorMessage } = useI18n()
  const [departments, setDepartments] = useState<DepartmentRates[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    api<{ departments: DepartmentRates[] }>('/pay-rates')
      .then((result) => {
        if (!cancelled) setDepartments(result.departments)
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [reloads, errorMessage])

  if (error) return <ErrorMessage>{error}</ErrorMessage>
  if (!departments) return <p className="text-slate-500">{t('common.loading')}</p>
  return (
    <div className="space-y-4 md:max-w-3xl">
      <p className="text-sm text-slate-500">{t('pay.ratesHint')}</p>
      {departments.map((d) => (
        <DepartmentRatesCard key={d.id} department={d} onChanged={() => setReloads((n) => n + 1)} />
      ))}
    </div>
  )
}

function DepartmentRatesCard({ department: d, onChanged }: { department: DepartmentRates; onChanged: () => void }) {
  const { t, locale, errorMessage, departmentName } = useI18n()
  const today = new Intl.DateTimeFormat('en-CA').format(new Date()) // local YYYY-MM-DD
  const current = d.rates.find((r) => r.effectiveFrom <= today) ?? d.rates[d.rates.length - 1]
  const [adding, setAdding] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [payType, setPayType] = useState<PayType>(current?.payType ?? 'FIXED')
  const [amount, setAmount] = useState(agorotToInput((current?.payType === 'TIPS' ? current.minimumHourlyRate : current?.hourlyRate) ?? 0))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const describe = (r: (typeof d.rates)[number]) =>
    r.payType === 'FIXED'
      ? `${t('pay.typeFixed')} · ${r.hourlyRate ? t('pay.perHour', { amount: formatShekels(r.hourlyRate, locale) }) : t('pay.noRateSet')}`
      : `${t('pay.typeTips')} · ${r.minimumHourlyRate ? t('pay.minimumPerHour', { amount: formatShekels(r.minimumHourlyRate, locale) }) : t('pay.noMinimum')}`

  async function save() {
    const agorot = parseShekels(amount)
    if (agorot === null) return setError(t('report.badAmount'))
    setError(null)
    setBusy(true)
    try {
      await api('/pay-rates', {
        method: 'POST',
        body: {
          departmentId: d.id,
          effectiveFrom,
          payType,
          ...(payType === 'FIXED' ? { hourlyRate: agorot || null } : { minimumHourlyRate: agorot || null }),
        },
      })
      setAdding(false)
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await api(`/pay-rates/${id}`, { method: 'DELETE' })
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">{departmentName(d.name)}</h2>
        {current && (
          <p className={`text-sm ${current.payType === 'FIXED' && !current.hourlyRate ? 'text-amber-700' : 'text-slate-700'}`}>{describe(current)}</p>
        )}
      </div>
      <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        {d.rates.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-slate-500" dir="ltr">
              {t('pay.from')} {r.effectiveFrom}
            </span>
            <span className="flex-1 text-end text-slate-800">{describe(r)}</span>
            {d.rates.length > 1 && (
              <button aria-label={t('pay.deleteRate')} onClick={() => remove(r.id)} className="text-slate-400 hover:text-red-600">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs text-slate-500">{t('pay.from')}</span>
            <input type="date" dir="ltr" className={inputClass} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{t('pay.payType')}</span>
            <select className={inputClass} value={payType} onChange={(e) => setPayType(e.target.value as PayType)}>
              <option value="FIXED">{t('pay.typeFixed')}</option>
              <option value="TIPS">{t('pay.typeTips')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{payType === 'FIXED' ? t('pay.hourlyRate') : t('pay.minimumRate')}</span>
            <div className="flex items-center gap-1" dir="ltr">
              <span className="text-slate-500">₪</span>
              <input inputMode="decimal" className={inputClass} value={amount} placeholder={payType === 'TIPS' ? '0' : ''} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </label>
          {error && (
            <div className="sm:col-span-3">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <Button variant="secondary" className="w-auto! py-2!" onClick={() => setAdding(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button className="w-auto! py-2!" onClick={save} disabled={busy}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="mt-3">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
          <button onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-indigo-600">
            {t('pay.newRate')}
          </button>
        </>
      )}
    </Card>
  )
}
