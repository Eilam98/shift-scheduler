import type { MessageKey } from '../i18n/messages'
import type { DepartmentRoles } from '../types'

/** Translation key for the user's role — pass it to t(). */
export function roleLabel(user: DepartmentRoles & { isRestaurantManager: boolean }): MessageKey {
  if (user.isRestaurantManager) return 'role.restaurantManager'
  if (user.managedDepartment) return 'role.departmentManager'
  return 'role.worker'
}
