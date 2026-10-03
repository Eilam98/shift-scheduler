import { NextFunction, Request, Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { assignmentNotifications, isWeekPosted } from "../lib/notifications";
import { pushInBackground } from "../lib/push";
import { authenticate, requireDepartmentManager } from "../middleware/auth";

const router = Router();

/**
 * Loads the slot (with its shift, for the week) into res.locals.slot so
 * permission checks can use its department.
 */
async function loadSlot(req: Request, res: Response, next: NextFunction) {
  const slot = await prisma.shiftSlot.findUnique({
    where: { id: req.params.id as string },
    include: { shift: true },
  });
  if (!slot) {
    return res.status(404).json({ error: "Slot not found" });
  }
  res.locals.slot = slot;
  next();
}

// Every slot route: logged in + manager of the slot's department.
const canEditSlot = [
  authenticate,
  loadSlot,
  requireDepartmentManager((_req, res) => res.locals.slot.departmentId),
];

const assignSchema = z.object({
  userId: z.string().min(1).nullable(),
});

/**
 * PATCH /api/slots/:id — assign a worker (or null to empty the slot). The
 * worker must belong to the slot's department and can't already hold another
 * slot in the same shift (in any department).
 */
router.patch("/:id", ...canEditSlot, async (req: Request, res: Response) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "userId is required (use null to clear the slot)" });
  }
  const { userId } = parsed.data;
  const slot = res.locals.slot;

  if (userId) {
    const membership = await prisma.departmentMembership.findUnique({
      where: { userId_departmentId: { userId, departmentId: slot.departmentId } },
      include: { user: true },
    });
    if (!membership || !membership.user.isActive) {
      return res
        .status(400)
        .json({ error: "That worker isn't in this department", code: "NOT_IN_DEPARTMENT" });
    }

    const clash = await prisma.shiftSlot.findFirst({
      where: { shiftId: slot.shiftId, userId, id: { not: slot.id } },
      include: { department: true, user: true },
    });
    if (clash) {
      return res.status(409).json({
        error: `${clash.user!.name} already works this shift (${clash.department.name})`,
        code: "ALREADY_IN_SHIFT",
        params: { name: clash.user!.name, department: clash.department.name },
      });
    }
  }

  // If the week is posted, the people taken off / put on the slot are notified
  // (written together with the change in one batch transaction).
  const notifications = (await isWeekPosted(prisma, slot.shift.scheduleId, slot.departmentId))
    ? assignmentNotifications({ slot, oldUserId: slot.userId, newUserId: userId, actorId: req.user!.id })
    : [];
  const [updated] = await prisma.$transaction([
    prisma.shiftSlot.update({
      where: { id: slot.id },
      data: { userId },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.notification.createMany({ data: notifications }),
  ]);
  pushInBackground(notifications);

  return res.status(200).json({ id: updated.id, user: updated.user });
});

// DELETE /api/slots/:id — remove the slot entirely (its worker is notified if the week is posted).
router.delete("/:id", ...canEditSlot, async (req: Request, res: Response) => {
  const slot = res.locals.slot;
  const notifications =
    slot.userId && (await isWeekPosted(prisma, slot.shift.scheduleId, slot.departmentId))
      ? assignmentNotifications({ slot, oldUserId: slot.userId, newUserId: null, actorId: req.user!.id })
      : [];
  await prisma.$transaction([
    prisma.shiftSlot.delete({ where: { id: slot.id } }),
    prisma.notification.createMany({ data: notifications }),
  ]);
  pushInBackground(notifications);
  return res.status(204).end();
});

export default router;
