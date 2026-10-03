// Money is integer agorot everywhere (₪70 = 7000); these convert for display and input.

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
