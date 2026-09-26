// Same rule the server enforces (isValidPassword in server/src/lib/auth.ts).
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
export const PASSWORD_HINT = 'At least 8 characters, with at least one letter and one number.'

// No look-alike characters (0/O, 1/l/I) — these get read out or typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/** Random temporary password that satisfies PASSWORD_RULE. */
export function generateTemporaryPassword(length = 10): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(length))
    const password = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
    if (PASSWORD_RULE.test(password)) return password
  }
}
