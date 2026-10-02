import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { newStationToken } from "../lib/stations";
import { authenticate, requireRestaurantManager } from "../middleware/auth";

// Managing time clock devices — restaurant manager only.
const router = Router();
router.use(authenticate, requireRestaurantManager);

function toStationResponse(s: {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}) {
  return { id: s.id, name: s.name, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, revokedAt: s.revokedAt };
}

// GET /api/stations — every station, active first.
router.get("/", async (_req, res) => {
  const stations = await prisma.stationDevice.findMany({ orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }] });
  return res.status(200).json({ stations: stations.map(toStationResponse) });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(60) });

/**
 * POST /api/stations { name } — "use this device as the time clock". Returns
 * the device's secret key ONCE; only its hash is stored.
 */
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "name is required" });

  const { token, tokenHash } = newStationToken();
  const station = await prisma.stationDevice.create({
    data: { name: parsed.data.name, tokenHash, createdById: req.user!.id },
  });
  return res.status(201).json({ station: toStationResponse(station), token });
});

// DELETE /api/stations/:id — revoke: the device stops working immediately (the row stays for history).
router.delete("/:id", async (req, res) => {
  const station = await prisma.stationDevice.findUnique({ where: { id: req.params.id as string } });
  if (!station) return res.status(404).json({ error: "Station not found" });
  if (!station.revokedAt) {
    await prisma.stationDevice.update({ where: { id: station.id }, data: { revokedAt: new Date() } });
  }
  return res.status(204).end();
});

export default router;
