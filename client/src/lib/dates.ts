// Dates travel as "YYYY-MM-DD" strings (see server/src/lib/dates.ts). These
// helpers work on calendar dates only, so time zones never shift a day.

/** 0 = Sunday — must match WEEK_START_DAY on the server. */
const WEEK_START_DAY = 0

function fromDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(value: string, days: number): string {
  const date = fromDateString(value)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateString(date)
}

/** The Sunday on or before today (in the user's local calendar). */
export function currentWeekStart(): string {
  const now = new Date()
  const today = toDateString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
  const day = fromDateString(today).getUTCDay()
  return addDays(today, -((day - WEEK_START_DAY + 7) % 7))
}

export function isWeekStart(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = fromDateString(value)
  return toDateString(date) === value && date.getUTCDay() === WEEK_START_DAY
}

// `locale` comes from useI18n() ("he-IL" / "en-GB"). timeZone UTC because the
// Date objects here are UTC midnights standing for calendar dates.

/** "Sunday 6 Jan" / "יום ראשון, 6 בינו׳" */
export function formatDay(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(fromDateString(value))
}

/** "6–12 Jan 2030" — Intl picks the right range format for the language. */
export function formatWeekRange(weekStart: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).formatRange(fromDateString(weekStart), fromDateString(addDays(weekStart, 6)))
}

// Months travel as "YYYY-MM".

/** This month in the user's local calendar, "YYYY-MM". */
export function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + n, 1))
  return toDateString(date).slice(0, 7)
}

export const isMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

/** "October 2026" / "אוקטובר 2026" */
export function formatMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fromDateString(`${month}-01`))
}

/** The Sunday on or before a date — for linking a day to its week. */
export function weekStartOf(value: string): string {
  const day = fromDateString(value).getUTCDay()
  return addDays(value, -((day - WEEK_START_DAY + 7) % 7))
}
