// End-of-shift report helpers. splitTips mirrors server/src/lib/tips.ts so the
// page can show shares live while typing; the server's numbers are the real ones.

/** Split a tip pool (agorot) by minutes; leftover agorot go to the largest remainders. */
export function splitTips(total: number, minutes: number[]): number[] {
  const sum = minutes.reduce((a, b) => a + b, 0)
  if (total <= 0 || sum <= 0) return minutes.map(() => 0)
  const exact = minutes.map((m) => (total * m) / sum)
  const shares = exact.map(Math.floor)
  const leftover = total - shares.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((value, i) => ({ i, remainder: value - shares[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
  for (let k = 0; k < leftover; k++) shares[byRemainder[k].i]++
  return shares
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Minutes from start to end ("HH:mm"); an end not after the start is the next day. */
export function minutesBetween(start: string, end: string): number {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 0
  return ((toMinutes(end) - toMinutes(start) + 24 * 60 - 1) % (24 * 60)) + 1
}

/** 450 → "7:30" */
export function formatHours(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/** "1234.5" / "1,234.50" → 123450 agorot, or null if it isn't an amount. Integer maths only. */
export function parseShekels(input: string): number | null {
  const clean = input.trim().replace(/,/g, '')
  if (clean === '') return 0
  const match = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(clean)
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

/** 123450 → "₪1,234.50" in the UI language. */
export function formatShekels(agorot: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'ILS' }).format(agorot / 100)
}

/** 123450 → "1234.50" for an input field. */
export const agorotToInput = (agorot: number) =>
  agorot === 0 ? '' : `${Math.floor(agorot / 100)}${agorot % 100 ? `.${String(agorot % 100).padStart(2, '0')}` : ''}`
