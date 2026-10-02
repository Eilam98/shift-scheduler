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

/** Today's calendar date ("YYYY-MM-DD") in the given IANA time zone. */
export function todayInTimeZone(timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** How far `timeZone` is ahead of UTC at `instant`, in ms (e.g. +3h in Israel summer). */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value])
  );
  const wallClockAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The real moment of a wall-clock time in a time zone, e.g. ("2026-09-30",
 * "23:59", "Asia/Jerusalem") → 2026-09-30T20:59Z. Two passes so the offset is
 * the one in force at that moment (daylight saving changes it).
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const wallClock = parseDate(date)!.getTime() + (hours * 60 + minutes) * 60_000;
  let utc = wallClock - timeZoneOffsetMs(new Date(wallClock), timeZone);
  utc = wallClock - timeZoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

/**
 * Availability deadline for the week starting `weekStart`: `day` (0=Sun … 6=Sat)
 * of the week BEFORE, at `time` in the restaurant time zone. Wednesday 23:59
 * → weekStart − 4 days at 23:59 Israel time.
 */
export function availabilityDeadline(
  weekStart: Date,
  settings: { availabilityDeadlineDay: number; availabilityDeadlineTime: string; timeZone: string }
): Date {
  const date = toDateString(addDays(weekStart, settings.availabilityDeadlineDay - 7));
  return zonedTimeToUtc(date, settings.availabilityDeadlineTime, settings.timeZone);
}

/** The deadline minute still counts ("until 23:59"); locked from the next minute. */
export function isPastDeadline(deadline: Date, now = new Date()): boolean {
  return now.getTime() >= deadline.getTime() + 60_000;
}

/** Sunday on or before a "YYYY-MM-DD" date. */
export function weekStartOf(date: string): Date {
  const d = parseDate(date)!;
  return addDays(d, -((d.getUTCDay() - WEEK_START_DAY + 7) % 7));
}

/**
 * The real start and end moments of a shift (date + "HH:mm" times in the
 * restaurant zone). An end time not after the start means it ends next day.
 */
export function shiftWindow(
  date: Date,
  startTime: string,
  endTime: string,
  timeZone: string
): { start: Date; end: Date } {
  const day = toDateString(date);
  const endDay = endTime <= startTime ? toDateString(addDays(date, 1)) : day;
  return { start: zonedTimeToUtc(day, startTime, timeZone), end: zonedTimeToUtc(endDay, endTime, timeZone) };
}

/** "YYYY-MM-DDTHH:mm" (an <input type="datetime-local"> value) in a time zone → the real moment, or null. */
export function parseZonedDateTime(value: string, timeZone: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(value);
  if (!match || !parseDate(match[1]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(match[2])) return null;
  return zonedTimeToUtc(match[1], match[2], timeZone);
}
