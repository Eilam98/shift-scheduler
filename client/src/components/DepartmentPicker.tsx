import { useI18n } from '../i18n/i18nContext'
import type { Department, DepartmentRolesInput } from '../types'

/**
 * Per department: does this user work in it, and do they manage it? The two
 * are independent. A user can manage several departments, but a department
 * has at most one manager — departments managed by someone else are locked
 * (mirrors validateDepartmentRoles in server/src/routes/users.ts).
 */
export function DepartmentPicker({
  departments,
  value,
  onChange,
  otherManagers,
}: {
  departments: Department[]
  value: DepartmentRolesInput
  onChange: (value: DepartmentRolesInput) => void
  /** departmentId → name of the person (other than this user) who manages it */
  otherManagers: Map<string, string>
}) {
  const { t, departmentName } = useI18n()

  function toggle(list: 'memberDepartmentIds' | 'managedDepartmentIds', id: string, on: boolean) {
    onChange({
      ...value,
      [list]: on ? [...value[list], id] : value[list].filter((d) => d !== id),
    })
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{t('picker.departments')}</legend>
      {departments.map((dept) => {
        const otherManager = otherManagers.get(dept.id)
        return (
          <div
            key={dept.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-slate-200 px-3 py-2.5"
          >
            <span className="font-medium text-slate-900">{departmentName(dept.name)}</span>
            <div className="flex items-center gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-5 accent-indigo-600"
                  checked={value.memberDepartmentIds.includes(dept.id)}
                  onChange={(e) => toggle('memberDepartmentIds', dept.id, e.target.checked)}
                />
                {t('picker.worksHere')}
              </label>
              {otherManager ? (
                <span className="text-xs text-slate-500">
                  {t('picker.managedBy', { name: otherManager })}
                </span>
              ) : (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-indigo-600"
                    checked={value.managedDepartmentIds.includes(dept.id)}
                    onChange={(e) => toggle('managedDepartmentIds', dept.id, e.target.checked)}
                  />
                  {t('picker.manager')}
                </label>
              )}
            </div>
          </div>
        )
      })}
      <p className="text-xs text-slate-500">{t('picker.hint')}</p>
    </fieldset>
  )
}
