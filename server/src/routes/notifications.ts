import { Router } from "express";
import { prisma } from "../lib/prisma";
import { toDateString } from "../lib/dates";
import { authenticate } from "../middleware/auth";

const router = Router();

// Every logged-in user reads only their own notifications.
router.use(authenticate);

// GET /api/notifications — my latest 50, newest first, + how many are unread.
router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { department: true, schedule: true, shift: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return res.status(200).json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      read: n.readAt !== null,
      createdAt: n.createdAt,
      department: { id: n.department.id, name: n.department.name },
      weekStartDate: toDateString(n.schedule.weekStartDate),
      shift: n.shift
        ? {
            date: toDateString(n.shift.date),
            label: n.shift.label,
            startTime: n.shift.startTime,
            endTime: n.shift.endTime,
          }
        : null,
    })),
  });
});

// GET /api/notifications/unread-count — cheap, polled by the bell.
router.get("/unread-count", async (req, res) => {
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, readAt: null },
  });
  return res.status(200).json({ unreadCount });
});

// POST /api/notifications/read — mark all of mine as read.
router.post("/read", async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, readAt: null },
    data: { readAt: new Date() },
  });
  return res.status(200).json({ unreadCount: 0 });
});

export default router;
