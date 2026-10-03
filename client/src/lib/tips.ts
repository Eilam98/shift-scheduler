// End-of-shift report helpers. splitTips mirrors server/src/lib/tips.ts so the
// page can show shares live while typing; the server's numbers are the real ones.
// Money formatting lives in lib/money.ts.

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
