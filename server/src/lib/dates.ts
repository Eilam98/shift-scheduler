// Calendar dates are stored as midnight UTC and exchanged with the client as
// "YYYY-MM-DD" strings, so a date never shifts because of time zones.

/** 0 = Sunday. Schedules run Sunday–Saturday. */
export const WEEK_START_DAY = 0;

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/** Parses "YYYY-MM-DD" into a UTC-midnight Date, or null if invalid. */
export function parseDate(value: string): Date | null {
  if (!DATE_FORMAT.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || toDateString(date) !== value ? null : date;
}

/** Like parseDate, but also requires the date to be a week start (Sunday). */
export function parseWeekStart(value: string): Date | null {
  const date = parseDate(value);
  return date && date.getUTCDay() === WEEK_START_DAY ? date : null;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
