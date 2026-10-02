import { createHmac, randomInt } from "crypto";
import { prisma } from "./prisma";

const PIN_SECRET = process.env.PIN_SECRET;
if (!PIN_SECRET) {
  throw new Error("PIN_SECRET is not set. Add a long random string to server/.env (see .env.example).");
}

export const PIN_RULE = /^\d{4}$/;

/**
 * Time clock PINs are stored as a keyed hash (HMAC-SHA256). Unlike bcrypt it
 * gives the same output for the same PIN, so the station can find a worker by
 * PIN alone and the database can keep PINs unique — while the stored value is
 * useless without PIN_SECRET.
 */
export function hashPin(pin: string): string {
  return createHmac("sha256", PIN_SECRET as string).update(pin).digest("hex");
}

/** A random 4-digit PIN nobody else has (avoids 0000-style repeats). */
export async function generateUniquePin(): Promise<{ pin: string; pinHash: string }> {
  for (;;) {
    const pin = String(randomInt(0, 10_000)).padStart(4, "0");
    if (/^(\d)\1{3}$/.test(pin)) continue;
    const pinHash = hashPin(pin);
    if (!(await prisma.user.findUnique({ where: { pinHash } }))) return { pin, pinHash };
  }
}
