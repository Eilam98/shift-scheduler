import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { AddWorkerForm } from '../components/AddWorkerForm'
import { DepartmentPicker } from '../components/DepartmentPicker'
import { Button, Card, ErrorMessage, Screen } from '../components/ui'
import { api } from '../lib/api'
import { roleLabel } from '../lib/roles'
import type { Department, DepartmentAssignment, UserListItem } from '../types'

type Created = { name: string; email: string; temporaryPassword: string }

/** Restaurant manager only: list everyone, add workers, edit department assignments. */
export function WorkersPage() {
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
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load workers')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function replaceUser(updated: UserListItem) {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
  }

  return (
    <Screen>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Workers</h1>
        <Link to="/" className="text-sm font-medium text-indigo-600">
          ← Home
        </Link>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

      {created && (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">{created.name} was added.</p>
          <p className="mt-1">Share these login details with them:</p>
          <p className="mt-2 font-mono break-all">
            {created.email}
            <br />
            {created.temporaryPassword}
          </p>
          <p className="mt-2">They'll choose their own password on first login.</p>
          <button onClick={() => setCreated(null)} className="mt-3 font-medium underline">
            Done
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <div className="space-y-3">
          {adding ? (
            <Card>
              <AddWorkerForm
                departments={departments}
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
              onClick={() => {
                setAdding(true)
                setEditingId(null)
                setCreated(null)
              }}
            >
              + Add worker
            </Button>
          )}

          {users.map((user) =>
            editingId === user.id ? (
              <EditDepartmentsCard
                key={user.id}
                user={user}
                departments={departments}
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
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{user.name}</p>
          <p className="truncate text-sm text-slate-500">{user.email}</p>
          <p className="mt-1 text-xs font-medium tracking-wide text-indigo-700 uppercase">
            {roleLabel(user)}
          </p>
        </div>
        {onEdit && (
          <button onClick={onEdit} className="shrink-0 text-sm font-medium text-indigo-600">
            Edit
          </button>
        )}
      </div>
      {user.departments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {user.departments.map((d) => (
            <span
              key={d.departmentId}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                d.isManager ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {d.departmentName}
              {d.isManager && ' · manager'}
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
  onSaved,
  onCancel,
}: {
  user: UserListItem
  departments: Department[]
  onSaved: (user: UserListItem) => void
  onCancel: () => void
}) {
  const [assignments, setAssignments] = useState<DepartmentAssignment[]>(() =>
    user.departments.map(({ departmentId, isManager }) => ({ departmentId, isManager }))
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const updated = await api<UserListItem>(`/users/${user.id}/departments`, {
        method: 'PATCH',
        body: { departments: assignments },
      })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <p className="mb-3 font-semibold text-slate-900">{user.name}</p>
      <DepartmentPicker departments={departments} value={assignments} onChange={setAssignments} />
      {error && (
        <div className="mt-3">
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Card>
  )
}
