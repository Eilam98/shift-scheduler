import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, isValidPassword, signToken } from "../lib/auth";
import { authenticate } from "../middleware/auth";

const router = Router();

function toUserResponse(user: {
  id: string;
  name: string;
  email: string;
  isRestaurantManager: boolean;
  requiresPasswordChange: boolean;
  departments: { departmentId: string; isManager: boolean; department: { name: string } }[];
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isRestaurantManager: user.isRestaurantManager,
    requiresPasswordChange: user.requiresPasswordChange,
    departments: user.departments.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.department.name,
      isManager: d.isManager,
    })),
  };
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { departments: { include: { department: true } } },
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user: toUserResponse(user) });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { departments: { include: { department: true } } },
  });

  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  return res.status(200).json({ user: toUserResponse(user) });
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

// PATCH /api/auth/password
router.patch("/password", authenticate, async (req, res) => {
  const parsed = passwordChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (!isValidPassword(newPassword)) {
    return res
      .status(400)
      .json({ error: "New password must be at least 8 characters and include a letter and a number" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  const currentOk = await comparePassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, requiresPasswordChange: false },
  });

  return res.status(200).json({ success: true });
});

export default router;
