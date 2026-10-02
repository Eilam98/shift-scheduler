import { createHash, randomBytes } from "crypto";

/** A station's secret key: long and random, so storing only its SHA-256 is safe. */
export function newStationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashStationToken(token) };
}

export function hashStationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
