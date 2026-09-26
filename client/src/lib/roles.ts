export function roleLabel(user: {
  isRestaurantManager: boolean
  departments: { isManager: boolean }[]
}): string {
  if (user.isRestaurantManager) return 'Restaurant manager'
  if (user.departments.some((d) => d.isManager)) return 'Department manager'
  return 'Worker'
}
