import { Router } from "express";
import { computePayroll, monthBounds } from "../lib/payroll";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

// Payroll (restaurant manager) and each worker's own earnings — both from
// computePayroll in lib/payroll.ts, so the numbers always agree.
const router = Router();
router.use(authenticate);

const BAD_MONTH = { error: "month must be YYYY-MM" };

// GET /api/payroll/me?month=YYYY-MM — my hours and earnings (current month = estimate).
router.get("/me", async (req, res) => {
  const month = String(req.query.month ?? "");
  if (!monthBounds(month)) return res.status(400).json(BAD_MONTH);
  const payroll = await computePayroll(month, [req.user!.id]);
  return res.status(200).json({
    month,
    timeZone: payroll.timeZone,
    isCurrentMonth: payroll.isCurrentMonth,
    me: payroll.workers[0] ?? null,
    // only my own entries' issues (e.g. a missing clock-out the manager should fix)
    warnings: payroll.warnings.filter((w) => "userId" in w && w.userId === req.user!.id),
  });
});

// GET /api/payroll?month=YYYY-MM — everyone, totals and warnings.
router.get("/", requireRestaurantManager, async (req, res) => {
  const month = String(req.query.month ?? "");
  if (!monthBounds(month)) return res.status(400).json(BAD_MONTH);
  return res.status(200).json(await computePayroll(month));
});

export default router;
