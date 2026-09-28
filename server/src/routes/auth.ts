import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, isValidPassword, signToken } from "../lib/auth";
import { departmentRolesInclude, toDepartmentRoles } from "../lib/users";
import { authenticate } from "../middleware/auth";

const router = Router();

function toUserResponse(
  user: Prisma.UserGetPayload<{ include: typeof departmentRolesInclude }>
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isRestaurantManager: user.isRestaurantManager,
    requiresPasswordChange: user.requiresPasswordChange,
    language: user.language, // null = restaurant default
    ...toDepartmentRoles(user),
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
    include: departmentRolesInclude,
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid email or password", code: "INVALID_CREDENTIALS" });
  }

  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: "Invalid email or password", code: "INVALID_CREDENTIALS" });
  }

  // Checked after the password, so it doesn't reveal which emails exist.
  if (!user.isActive) {
    return res.status(403).json({ error: "This account has been deactivated", code: "ACCOUNT_DEACTIVATED" });
  }

  const token = signToken({ userId: user.id });
  return res.status(200).json({ token, user: toUserResponse(user) });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: departmentRolesInclude,
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
      .json({
        error: "New password must be at least 8 characters and include a letter and a number",
        code: "INVALID_PASSWORD",
      });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) {
    return res.status(401).json({ error: "User no longer exists" });
  }

  const currentOk = await comparePassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    return res.status(401).json({ error: "Current password is incorrect", code: "WRONG_CURRENT_PASSWORD" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, requiresPasswordChange: false },
  });

  return res.status(200).json({ success: true });
});

const languageSchema = z.object({
  language: z.enum(["HE", "EN"]).nullable(), // null = use the restaurant default
});

// PATCH /api/auth/language — the logged-in user's own language preference.
router.patch("/language", authenticate, async (req, res) => {
  const parsed = languageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "language must be HE, EN or null" });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { language: parsed.data.language },
    include: departmentRolesInclude,
  });

  return res.status(200).json({ user: toUserResponse(user) });
});

export default router;
