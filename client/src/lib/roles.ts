import type { DepartmentRoles } from '../types'

export function roleLabel(user: DepartmentRoles & { isRestaurantManager: boolean }): string {
  if (user.isRestaurantManager) return 'Restaurant manager'
  if (user.managedDepartment) return 'Department manager'
  return 'Worker'
}
