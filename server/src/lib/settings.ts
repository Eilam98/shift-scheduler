import { prisma } from "./prisma";

/** The one RestaurantSettings row (defaults if the seed hasn't created it). */
export async function getSettings() {
  return (
    (await prisma.restaurantSettings.findUnique({ where: { id: 1 } })) ?? {
      id: 1,
      availabilityDeadlineDay: 3,
      availabilityDeadlineTime: "23:59",
      defaultLanguage: "HE" as const,
      timeZone: "Asia/Jerusalem",
    }
  );
}
