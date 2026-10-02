import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../lib/auth";

export interface AuthenticatedUser {
  id: string;
  isRestaurantManager: boolean;
  memberDepartmentIds: string[]; // departments the user works in
  managedDepartmentIds: string[]; // departments they manage (independent of membership)
}

// Augment Express's Request type so req.user is typed everywhere it's used.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Verifies the JWT and re-fetches the user's CURRENT role/department data
 * from the DB on every request. The token itself only carries { userId } —
 * roles and department membership can change after the token was issued
 * (e.g. a promotion to department manager), so we never trust stale claims
 * baked into the token. See PROJECT_SPEC.md "JWT" section.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const { userId } = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { memberships: true, managedDepartments: true },
    });

    // A deactivated user's existing tokens stop working immediately.
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    req.user = {
      id: user.id,
      isRestaurantManager: user.isRestaurantManager,
      memberDepartmentIds: user.memberships.map((m) => m.departmentId),
      managedDepartmentIds: user.managedDepartments.map((m) => m.departmentId),
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRestaurantManager(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isRestaurantManager) {
    return res.status(403).json({ error: "Restaurant manager access required" });
  }
  next();
}

/** True if the user is the restaurant manager or manages this department. */
export function canManageDepartment(user: AuthenticatedUser, departmentId: string): boolean {
  return user.isRestaurantManager || user.managedDepartmentIds.includes(departmentId);
}

/**
 * Returns a middleware that allows the request through if the caller is
 * either the restaurant manager, or a department manager for the specific
 * departmentId resolved from the request (e.g. req.params.departmentId, or
 * res.locals set by an earlier middleware that loaded a row from the DB).
 */
export function requireDepartmentManager(
  getDepartmentId: (req: Request, res: Response) => string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!canManageDepartment(user, getDepartmentId(req, res))) {
      return res.status(403).json({ error: "Department manager access required" });
    }

    next();
  };
}

/** Restaurant manager, or manager of at least one department. */
export function requireAnyManager(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.isRestaurantManager && !user?.managedDepartmentIds.length) {
    return res.status(403).json({ error: "Manager access required" });
  }
  next();
}

/**
 * May `user` see and change `targetUserId`'s availability? The restaurant
 * manager: anyone. A department manager: anyone who works in a department
 * they manage.
 */
export async function canManageUser(user: AuthenticatedUser, targetUserId: string): Promise<boolean> {
  if (user.isRestaurantManager) return true;
  if (user.managedDepartmentIds.length === 0) return false;
  const membership = await prisma.departmentMembership.findFirst({
    where: { userId: targetUserId, departmentId: { in: user.managedDepartmentIds } },
  });
  return membership !== null;
}

/** The seeded name of the department whose members are shift managers. */
const SHIFT_MANAGERS_DEPARTMENT = "Shift Managers";

/**
 * May `user` see schedules that aren't posted yet (read-only where they can't
 * edit)? The restaurant manager, any department manager, and shift managers.
 */
export async function canViewDrafts(user: AuthenticatedUser): Promise<boolean> {
  if (user.isRestaurantManager || user.managedDepartmentIds.length > 0) return true;
  if (user.memberDepartmentIds.length === 0) return false;
  const shiftManagers = await prisma.department.findUnique({ where: { name: SHIFT_MANAGERS_DEPARTMENT } });
  return !!shiftManagers && user.memberDepartmentIds.includes(shiftManagers.id);
}
