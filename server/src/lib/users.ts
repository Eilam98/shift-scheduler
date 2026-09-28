import { Prisma } from "@prisma/client";

/** Prisma `include` that loads what toDepartmentRoles needs. */
export const departmentRolesInclude = {
  memberships: { include: { department: true } },
  managedDepartment: { include: { department: true } },
} satisfies Prisma.UserInclude;

type UserWithDepartmentRoles = Prisma.UserGetPayload<{ include: typeof departmentRolesInclude }>;

/**
 * The department part of every user response: where they work, and the one
 * department they manage (null if none). The two are independent — a manager
 * doesn't have to be a member of the department they manage.
 */
export function toDepartmentRoles(user: UserWithDepartmentRoles) {
  return {
    memberships: user.memberships
      .map((m) => ({ departmentId: m.departmentId, departmentName: m.department.name }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName)),
    managedDepartment: user.managedDepartment
      ? {
          departmentId: user.managedDepartment.departmentId,
          departmentName: user.managedDepartment.department.name,
        }
      : null,
  };
}
