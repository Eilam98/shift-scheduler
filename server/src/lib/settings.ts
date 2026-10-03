import { cached, invalidate } from "./cache";
import { prisma } from "./prisma";

const KEY = "settings";

/** The one RestaurantSettings row (defaults if the seed hasn't created it). Cached for a minute. */
export function getSettings() {
  return cached(KEY, 60_000, async () => {
    return (
      (await prisma.restaurantSettings.findUnique({ where: { id: 1 } })) ?? {
        id: 1,
        availabilityDeadlineDay: 3,
        availabilityDeadlineTime: "23:59",
        defaultLanguage: "HE" as const,
        timeZone: "Asia/Jerusalem",
      }
    );
  });
}

/** Call after changing RestaurantSettings. */
export const invalidateSettings = () => invalidate(KEY);
