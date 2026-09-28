import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /api/settings/public — no login needed: the login screen uses the
// restaurant's default language before anyone is signed in.
router.get("/public", async (_req, res) => {
  const settings = await prisma.restaurantSettings.findUnique({ where: { id: 1 } });
  return res.status(200).json({ defaultLanguage: settings?.defaultLanguage ?? "HE" });
});

export default router;
