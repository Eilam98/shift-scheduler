import { useEffect, useState } from 'react'
import { AddWorkerForm } from '../components/AddWorkerForm'
import { DepartmentPicker } from '../components/DepartmentPicker'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { useI18n } from '../i18n/i18nContext'
import { api } from '../lib/api'
import { roleLabel } from '../lib/roles'
import type { Department, DepartmentRolesInput, UserListItem } from '../types'

type Created = { name: string; email: string; temporaryPassword: string }

/** Restaurant manager only: list everyone, add workers, edit department assignments. */
export function WorkersPage() {
  const { t, errorMessage } = useI18n()
  const [users, setUsers] = useState<UserListItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api<{ users: UserListItem[] }>('/users'),
      api<{ departments: Department[] }>('/departments'),
    ])
      .then(([u, d]) => {
        if (cancelled) return
        setUsers(u.users)
        setDepartments(d.departments)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [errorMessage])

  /** Who manages each department, leaving out `exceptUserId` (the person being edited). */
  function otherManagers(exceptUserId?: string): Map<string, string> {
    const map = new Map<string, string>()
    for (const u of users) {
      if (u.id === exceptUserId) continue
      for (const d of u.managedDepartments) map.set(d.departmentId, u.name)
    }
    return map
  }

  function replaceUser(updated: UserListItem) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  return (
    <Screen title={t('workers.title')}>
      {loading && <p className="text-slate-500">{t('common.loading')}</p>}
      {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

      {created && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">{t('workers.added', { name: created.name })}</p>
          <p className="mt-1">{t('workers.shareDetails')}</p>
          <p className="mt-2 font-mono break-all" dir="ltr">
            {created.email}
            <br />
            {created.temporaryPassword}
          </p>
          <p className="mt-2">{t('workers.firstLogin')}</p>
          <button onClick={() => setCreated(null)} className="mt-3 font-medium underline">
            {t('common.done')}
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="grid gap-3 lg:grid-cols-2">
          {adding ? (
            <Card className="lg:col-span-2">
              <AddWorkerForm
                departments={departments}
                otherManagers={otherManagers()}
                onCancel={() => setAdding(false)}
                onCreated={(user, temporaryPassword) => {
                  setUsers((prev) =>
                    [...prev, user].sort((a, b) => a.name.localeCompare(b.name))
                  )
                  setCreated({ name: user.name, email: user.email, temporaryPassword })
                  setAdding(false)
                }}
              />
            </Card>
          ) : (
            <Button
              className="lg:col-span-2 lg:w-auto lg:justify-self-start"
              onClick={() => {
                setAdding(true)
                setEditingId(null)
                setCreated(null)
              }}
            >
              {t('workers.add')}
            </Button>
          )}

          {users.map((user) =>
            editingId === user.id ? (
              <EditDepartmentsCard
                key={user.id}
                user={user}
                departments={departments}
                otherManagers={otherManagers(user.id)}
                onSaved={(updated) => {
                  replaceUser(updated)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <WorkerCard
                key={user.id}
                user={user}
                onEdit={
                  user.isRestaurantManager
                    ? undefined
                    : () => {
                        setEditingId(user.id)
                        setAdding(false)
                      }
                }
              />
            )
          )}
        </div>
      )}
    </Screen>
  )
}

function WorkerCard({ user, onEdit }: { user: UserListItem; onEdit?: () => void }) {
  const { t, departmentName } = useI18n()
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-sm text-slate-500" dir="ltr">
            {user.email}
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-indigo-700 uppercase">
            {t(roleLabel(user))}
            {!user.isActive && <span className="ms-2 text-slate-500">· {t('workers.inactive')}</span>}
          </p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="shrink-0 text-sm font-medium text-indigo-600">
            {t('common.edit')}
          </button>
        )}
      </div>
      {(user.memberships.length > 0 || user.managedDepartments.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {user.memberships.map((m) => (
            <span
              key={m.departmentId}
              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              {departmentName(m.departmentName)}
            </span>
          ))}
          {user.managedDepartments.map((m) => (
            <span
              key={m.departmentId}
              className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800"
            >
              {t('workers.managesChip', { department: departmentName(m.departmentName) })}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function EditDepartmentsCard({
  user,
  departments,
  otherManagers,
  onSaved,
  onCancel,
}: {
  user: UserListItem
  departments: Department[]
  otherManagers: Map<string, string>
  onSaved: (user: UserListItem) => void
  onCancel: () => void
}) {
  const { t, errorMessage } = useI18n()
  const [roles, setRoles] = useState<DepartmentRolesInput>(() => ({
    memberDepartmentIds: user.memberships.map((m) => m.departmentId),
    managedDepartmentIds: user.managedDepartments.map((m) => m.departmentId),
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const updated = await api<UserListItem>(`/users/${user.id}/departments`, {
        method: 'PATCH',
        body: roles,
      })
      onSaved(updated)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="lg:col-span-2">
      <p className="mb-3 font-semibold text-slate-900">{user.name}</p>
      <DepartmentPicker
        departments={departments}
        value={roles}
        onChange={setRoles}
        otherManagers={otherManagers}
      />
      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </Card>
  )
}
