import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { parseDate, toDateString } from "../lib/dates";
import { invalidatePayTypes } from "../lib/pay";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

// Departments & pay (restaurant manager): each department's pay rate history.
// The rate with the latest effectiveFrom <= a day applies to that day.
const router = Router();
router.use(authenticate, requireRestaurantManager);

function toRateResponse(r: {
  id: string;
  effectiveFrom: Date;
  payType: "FIXED" | "TIPS";
  hourlyRate: number | null;
  minimumHourlyRate: number | null;
}) {
  return {
    id: r.id,
    effectiveFrom: toDateString(r.effectiveFrom),
    payType: r.payType,
    hourlyRate: r.hourlyRate,
    minimumHourlyRate: r.minimumHourlyRate,
  };
}

// GET /api/pay-rates — every department with its rate history (newest first).
router.get("/", async (_req, res) => {
  const departments = await prisma.department.findMany({
    include: { payRates: { orderBy: { effectiveFrom: "desc" } } },
    orderBy: { name: "asc" },
  });
  return res.status(200).json({
    departments: departments.map((d) => ({ id: d.id, name: d.name, rates: d.payRates.map(toRateResponse) })),
  });
});

const rateSchema = z
  .object({
    departmentId: z.string().min(1),
    effectiveFrom: z.string(),
    payType: z.enum(["FIXED", "TIPS"]),
    hourlyRate: z.number().int().min(1).max(1_000_000).nullable().optional(), // agorot / hour
    minimumHourlyRate: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .refine((r) => r.payType !== "FIXED" || !!r.hourlyRate, "An hourly department needs an hourly rate");

/**
 * POST /api/pay-rates — a rate that applies from `effectiveFrom` on. A rate
 * already starting on that date is replaced. Past months keep their rates.
 */
router.post("/", async (req, res) => {
  const parsed = rateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid rate", code: "INVALID_RATE" });
  }
  const { departmentId, payType } = parsed.data;
  const effectiveFrom = parseDate(parsed.data.effectiveFrom);
  if (!effectiveFrom) return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
  if (!(await prisma.department.findUnique({ where: { id: departmentId } }))) {
    return res.status(404).json({ error: "Department not found" });
  }

  const data = {
    payType,
    hourlyRate: payType === "FIXED" ? parsed.data.hourlyRate! : null,
    minimumHourlyRate: payType === "TIPS" ? (parsed.data.minimumHourlyRate ?? null) : null,
  };
  const rate = await prisma.departmentPayRate.upsert({
    where: { departmentId_effectiveFrom: { departmentId, effectiveFrom } },
    create: { departmentId, effectiveFrom, ...data },
    update: data,
  });
  invalidatePayTypes(); // who clocks in / who's in the report may have changed
  return res.status(200).json(toRateResponse(rate));
});

// DELETE /api/pay-rates/:id — remove a mistaken rate (a department keeps at least one).
router.delete("/:id", async (req, res) => {
  const rate = await prisma.departmentPayRate.findUnique({ where: { id: req.params.id as string } });
  if (!rate) return res.status(404).json({ error: "Rate not found" });
  const count = await prisma.departmentPayRate.count({ where: { departmentId: rate.departmentId } });
  if (count <= 1) {
    return res.status(400).json({ error: "A department needs at least one rate", code: "LAST_RATE" });
  }
  await prisma.departmentPayRate.delete({ where: { id: rate.id } });
  invalidatePayTypes();
  return res.status(204).end();
});

export default router;
