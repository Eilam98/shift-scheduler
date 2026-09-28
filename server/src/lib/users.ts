import { Prisma } from "@prisma/client";

/** Prisma `include` that loads what toDepartmentRoles needs. */
export const departmentRolesInclude = {
  memberships: { include: { department: true } },
  managedDepartments: { include: { department: true } },
} satisfies Prisma.UserInclude;

type UserWithDepartmentRoles = Prisma.UserGetPayload<{ include: typeof departmentRolesInclude }>;

type WithDepartment = { departmentId: string; department: { name: string } };

function toDepartmentRefs(rows: WithDepartment[]) {
  return rows
    .map((r) => ({ departmentId: r.departmentId, departmentName: r.department.name }))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName));
}

/**
 * The department part of every user response: where they work, and which
 * departments they manage. The two are independent — a manager doesn't have
 * to be a member of the departments they manage.
 */
export function toDepartmentRoles(user: UserWithDepartmentRoles) {
  return {
    memberships: toDepartmentRefs(user.memberships),
    managedDepartments: toDepartmentRefs(user.managedDepartments),
  };
}
