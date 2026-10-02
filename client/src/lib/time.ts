// Clock times (real moments, ISO strings) shown in the restaurant's time zone,
// so they read the same on every device. Calendar dates stay in lib/dates.ts.

function zonedParts(iso: string, timeZone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  )
}

/** "15:58" */
export function formatTime(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone)
  return `${p.hour}:${p.minute}`
}

/** The restaurant calendar date of a moment, "YYYY-MM-DD". */
export function zonedDate(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

/** Value for <input type="datetime-local">: "YYYY-MM-DDTHH:mm" in the restaurant zone. */
export function toZonedInput(iso: string, timeZone: string): string {
  const p = zonedParts(iso, timeZone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/** "7:32" (hours:minutes) between two moments. */
export function formatDuration(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000))
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}
