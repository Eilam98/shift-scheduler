import type { MessageKey } from '../i18n/messages'
import type { AvailabilityStatus } from '../types'

// Shared look for the three availability levels (+ "no answer"), used by the
// availability editor, the workers' submissions grid and the schedule editor.

export const STATUSES: AvailabilityStatus[] = ['AVAILABLE', 'PREFER_NOT', 'UNAVAILABLE']

export const STATUS_SYMBOL: Record<AvailabilityStatus | 'NONE', string> = {
  AVAILABLE: '✓',
  PREFER_NOT: '~',
  UNAVAILABLE: '✗',
  NONE: '?',
}

export const STATUS_LABEL: Record<AvailabilityStatus | 'NONE', MessageKey> = {
  AVAILABLE: 'availability.AVAILABLE',
  PREFER_NOT: 'availability.PREFER_NOT',
  UNAVAILABLE: 'availability.UNAVAILABLE',
  NONE: 'availability.NONE',
}

/** Background + text colour per level. */
export const STATUS_CLASSES: Record<AvailabilityStatus | 'NONE', string> = {
  AVAILABLE: 'bg-green-100 text-green-800',
  PREFER_NOT: 'bg-amber-100 text-amber-800',
  UNAVAILABLE: 'bg-red-100 text-red-800',
  NONE: 'bg-slate-100 text-slate-500',
}

/** Order used when sorting people in the schedule editor: best fit first. */
export const STATUS_RANK: Record<AvailabilityStatus | 'NONE', number> = {
  AVAILABLE: 0,
  PREFER_NOT: 1,
  NONE: 2,
  UNAVAILABLE: 3,
}

export const entryKey = (e: { date: string; label: string }) => `${e.date}/${e.label}`

/**
 * "Due Wed 30 Sep, 23:59 · in 2 days" — shown in the restaurant's time zone
 * so it's the same on every device. Returns the two parts separately.
 */
export function describeDeadline(deadlineIso: string, timeZone: string, locale: string) {
  const deadline = new Date(deadlineIso)
  const when = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(deadline)

  // Locks at the end of the deadline minute.
  const ms = deadline.getTime() + 60_000 - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const relative =
    ms > 86_400_000
      ? rtf.format(Math.floor(ms / 86_400_000), 'day')
      : ms > 3_600_000
        ? rtf.format(Math.floor(ms / 3_600_000), 'hour')
        : rtf.format(Math.max(1, Math.ceil(ms / 60_000)), 'minute')
  return { when, relative }
}

