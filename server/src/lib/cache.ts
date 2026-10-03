// A tiny in-memory cache for data that rarely changes but is read on many
// requests (restaurant settings, current pay types, the Shift Managers
// department id). Each read of the database costs a round trip, so we keep
// the value for a short while and drop it as soon as it's edited here.
// Edits made outside this server (e.g. Prisma Studio) show up within `ttlMs`.

const entries = new Map<string, { value: unknown; expires: number }>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = entries.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  entries.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Forget a cached value (call after changing what it was loaded from). */
export function invalidate(key: string) {
  entries.delete(key);
}
