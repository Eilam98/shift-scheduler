import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getSettings } from "../lib/settings";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

const router = Router();

// GET /api/settings/public — no login needed: the login screen uses the
// restaurant's default language before anyone is signed in.
router.get("/public", async (_req, res) => {
  const settings = await getSettings();
  return res.status(200).json({ defaultLanguage: settings.defaultLanguage });
});

async function toSettingsResponse() {
  const [settings, templates] = await Promise.all([
    getSettings(),
    prisma.shiftTemplate.findMany({ orderBy: { label: "asc" } }),
  ]);
  return {
    availabilityDeadlineDay: settings.availabilityDeadlineDay,
    availabilityDeadlineTime: settings.availabilityDeadlineTime,
    defaultLanguage: settings.defaultLanguage,
    timeZone: settings.timeZone,
    shiftTemplates: templates.map((t) => ({
      label: t.label,
      defaultStartTime: t.defaultStartTime,
      defaultEndTime: t.defaultEndTime,
    })),
  };
}

// GET /api/settings — restaurant manager only.
router.get("/", authenticate, requireRestaurantManager, async (_req, res) => {
  return res.status(200).json(await toSettingsResponse());
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must be HH:mm");

const settingsSchema = z.object({
  availabilityDeadlineDay: z.number().int().min(0).max(6),
  availabilityDeadlineTime: hhmm,
  defaultLanguage: z.enum(["HE", "EN"]),
  shiftTemplates: z
    .array(
      z
        .object({ label: z.enum(["MORNING", "EVENING"]), defaultStartTime: hhmm, defaultEndTime: hhmm })
        .refine((t) => t.defaultStartTime !== t.defaultEndTime, "A shift can't start and end at the same time")
    )
    .length(2)
    .refine((ts) => new Set(ts.map((t) => t.label)).size === 2, "Send MORNING and EVENING once each"),
});

/**
 * PATCH /api/settings — restaurant manager only. Shift times are the defaults
 * for weeks created from now on; existing weeks keep their times.
 */
router.patch("/", authenticate, requireRestaurantManager, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" });
  }
  const { shiftTemplates, ...settings } = parsed.data;

  await prisma.$transaction([
    prisma.restaurantSettings.upsert({ where: { id: 1 }, update: settings, create: { id: 1, ...settings } }),
    ...shiftTemplates.map(({ label, ...times }) =>
      prisma.shiftTemplate.upsert({ where: { label }, update: times, create: { label, ...times } })
    ),
  ]);

  return res.status(200).json(await toSettingsResponse());
});

export default router;
