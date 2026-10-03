import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { pushEnabled, sendPush, vapidPublicKey } from "../lib/push";
import { authenticate } from "../middleware/auth";

// Each person turns phone notifications on/off per device (Profile page).
const router = Router();
router.use(authenticate);

// GET /api/push/key — the public key the browser needs to subscribe (404 if push is off).
router.get("/key", (_req, res) => {
  if (!pushEnabled) return res.status(404).json({ error: "Push notifications aren't set up on this server" });
  return res.status(200).json({ publicKey: vapidPublicKey });
});

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
});

// POST /api/push/subscribe — this device wants notifications (re-subscribing moves it to the current user).
router.post("/subscribe", async (req, res) => {
  const parsed = subscriptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid push subscription" });
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: req.user!.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: req.user!.id },
  });
  return res.status(201).json({ subscribed: true });
});

// POST /api/push/unsubscribe { endpoint } — stop notifications on this device.
router.post("/unsubscribe", async (req, res) => {
  const parsed = z.object({ endpoint: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "endpoint is required" });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: req.user!.id } });
  return res.status(200).json({ subscribed: false });
});

const testSchema = z.object({ title: z.string().min(1).max(100), body: z.string().min(1).max(300) });

// POST /api/push/test { title, body } — send a test notification to all my devices.
router.post("/test", async (req, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "title and body are required" });
  const devices = await prisma.pushSubscription.count({ where: { userId: req.user!.id } });
  await sendPush([{ userId: req.user!.id, message: { ...parsed.data, url: "/profile" } }]);
  return res.status(200).json({ devices });
});

export default router;
