import React, { useState, useEffect, useCallback } from 'react'
import { Loader2, Server, CheckCircle, AlertCircle, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react'
import { systemsApi, type System, type AuthMethod } from '../api/systems'
import { cn } from '../lib/utils'

const isProd = import.meta.env.MODE === 'production'

function effectiveBaseUrl(sys: System): string | null {
  const url = isProd && sys.baseUrlProd ? sys.baseUrlProd : sys.baseUrl
  return url || null
}

function TypeBadge({ type }: { type: System['type'] }): React.ReactElement {
  const styles: Record<System['type'], string> = {
    source: 'bg-blue-50 text-blue-700 border-blue-200',
    target: 'bg-green-50 text-green-700 border-green-200',
    both: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', styles[type])}>
      {type}
    </span>
  )
}

function FormatBadge({ format }: { format: System['format'] }) {
  const styles: Record<string, string> = {
    json: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    xml: 'bg-orange-50 text-orange-700 border-orange-200',
    soap: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', styles[format] || 'bg-gray-50')}>
      {(format || 'json').toUpperCase()}
    </span>
  )
}

type HealthState = 'idle' | 'checking' | 'healthy' | 'unhealthy' | 'error'

function HealthCheckCell({ systemId, checkAllTrigger, onResult }: { systemId: string; checkAllTrigger?: number; onResult?: (err?: string, durationMs?: number) => void }) {
  const [state, setState] = useState<HealthState>('idle')
  const [detail, setDetail] = useState<string | null>(null)

  const check = useCallback(async () => {
    setState('checking')
    setDetail(null)
    try {
      const result = await systemsApi.healthCheck(systemId)
      if (result.status === 'healthy' || result.status === 'mock-healthy') {
        setState('healthy')
        setDetail(result.durationMs != null ? `${result.durationMs}ms` : null)
        onResult?.(undefined, result.durationMs)
      } else {
        setState(result.status === 'unhealthy' ? 'unhealthy' : 'error')
        setDetail(result.error || `HTTP ${result.statusCode}` || result.status)
        onResult?.(result.error ?? `HTTP ${result.statusCode}`, result.durationMs)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Check failed'
      setState('error')
      setDetail(msg)
      onResult?.(msg)
    }
  }, [systemId, onResult])

  // When parent triggers "Check all", run check
  useEffect(() => {
    if (checkAllTrigger != null && checkAllTrigger > 0) check()
  }, [checkAllTrigger, check])

  if (state === 'idle') {
    return (
      <button
        onClick={check}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Check
      </button>
    )
  }

  if (state === 'checking') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking...
      </div>
    )
  }

  if (state === 'healthy') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600" title={detail ?? undefined}>
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
        {detail ? `Healthy (${detail})` : 'Healthy'}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-600 max-w-[140px]" title={detail ?? undefined}>
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{detail || 'Error'}</span>
    </div>
  )
}

const AUTH_OPTIONS: { value: AuthMethod; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'basic', label: 'Basic' },
  { value: 'oauth2', label: 'OAuth2' },
]

interface SystemFormData {
  code: string;
  name: string;
  type: System['type'];
  format: System['format'];
  protocol: string;
  baseUrl: string;
  baseUrlProd: string;
  authMethod: AuthMethod;
  username: string;
  password: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  isMock: boolean;
  isActive: boolean;
}

const defaultForm: SystemFormData = {
  code: '',
  name: '',
  type: 'source',
  format: 'json',
  protocol: 'rest',
  baseUrl: '',
  baseUrlProd: '',
  authMethod: 'none',
  username: '',
  password: '',
  clientId: '',
  clientSecret: '',
  tokenUrl: '',
  isMock: false,
  isActive: true,
}

function systemToForm(sys: System | null): SystemFormData {
  if (!sys) return defaultForm
  const auth = sys.config?.auth
  return {
    code: sys.code,
    name: sys.name,
    type: sys.type,
    format: sys.format,
    protocol: sys.protocol || 'rest',
    baseUrl: sys.baseUrl ?? '',
    baseUrlProd: sys.baseUrlProd ?? '',
    authMethod: (sys.authMethod as AuthMethod) || 'none',
    username: (auth?.username as string) ?? '',
    password: '', // never pre-fill
    clientId: (auth?.clientId as string) ?? '',
    clientSecret: '', // never pre-fill
    tokenUrl: (auth?.tokenUrl as string) ?? '',
    isMock: sys.isMock,
    isActive: sys.isActive,
  }
}

function formToPayload(form: SystemFormData): Partial<System> {
  const payload: Partial<System> = {
    code: form.code.trim(),
    name: form.name.trim(),
    type: form.type,
    format: form.format,
    protocol: (form.protocol.trim() || 'rest') as 'rest' | 'soap' | 'grpc' | 'mock',
    baseUrl: form.baseUrl.trim() || undefined,
    baseUrlProd: form.baseUrlProd.trim() || undefined,
    authMethod: form.authMethod,
    isMock: form.isMock,
    isActive: form.isActive,
  }
  if (form.authMethod === 'basic') {
    payload.config = { auth: { username: form.username.trim(), password: form.password } }
  } else if (form.authMethod === 'oauth2') {
    payload.config = {
      auth: {
        clientId: form.clientId.trim(),
        clientSecret: form.clientSecret,
        tokenUrl: form.tokenUrl.trim(),
      },
    }
  } else {
    payload.config = {}
  }
  return payload
}

export function Systems() {
  const [systems, setSystems] = useState<System[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<SystemFormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [checkAllTrigger, setCheckAllTrigger] = useState(0)

  const load = () => {
    systemsApi.list().then(setSystems).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load systems.')
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openAdd = () => {
    setForm(defaultForm)
    setEditingId(null)
    setModalOpen('add')
    setError(null)
  }

  const openEdit = (sys: System) => {
    setForm(systemToForm(sys))
    setEditingId(sys.id)
    setModalOpen('edit')
    setError(null)
  }

  const closeModal = () => {
    setModalOpen(null)
    setEditingId(null)
    setForm(defaultForm)
  }

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and name are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await systemsApi.update(editingId, formToPayload(form))
      } else {
        await systemsApi.create(formToPayload(form))
      }
      load()
      closeModal()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await systemsApi.delete(id)
      setDeleteConfirm(null)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    }
  }

  return (
    <div className="px-4 py-4 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Systems Registry</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage source and target systems used across product lines. {isProd ? 'Production endpoints shown.' : 'Local/dev endpoints shown.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {systems.length > 0 && (
            <button
              onClick={() => setCheckAllTrigger((t) => t + 1)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Check all
            </button>
          )}
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add system
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">Dismiss</button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      )}

      {!loading && systems.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Server className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No systems registered yet</p>
          <p className="text-xs text-gray-400 mt-1">Click &quot;Add system&quot; to register one.</p>
        </div>
      )}

      {!loading && systems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Format</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Protocol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">URL</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Auth</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mock</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Health</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {systems.map((sys) => (
                <tr key={sys.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sys.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{sys.code}</td>
                  <td className="px-4 py-3"><TypeBadge type={sys.type} /></td>
                  <td className="px-4 py-3"><FormatBadge format={sys.format} /></td>
                  <td className="px-4 py-3 text-xs text-gray-600 uppercase">{sys.protocol}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate" title={effectiveBaseUrl(sys) ?? undefined}>
                    {effectiveBaseUrl(sys) ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 capitalize">{sys.authMethod || 'none'}</td>
                  <td className="px-4 py-3">
                    {sys.isMock ? (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Mock</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', sys.isActive ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400')}>
                      {sys.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><HealthCheckCell systemId={sys.id} checkAllTrigger={checkAllTrigger} /></td>
                  <td className="px-4 py-3 flex items-center gap-1">
                    <button onClick={() => openEdit(sys)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Edit"><Pencil className="w-4 h-4" /></button>
                    {deleteConfirm === sys.id ? (
                      <span className="flex items-center gap-1">
                        <button onClick={() => remove(sys.id)} className="text-xs text-red-600 dark:text-red-400 font-medium">Confirm</button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-500 dark:text-gray-400">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setDeleteConfirm(sys.id)} className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{modalOpen === 'add' ? 'Add system' : 'Edit system'}</h2>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. Guidewire PolicyCenter" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Code *</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" placeholder="e.g. gw-policycenter" disabled={!!editingId} />
                {editingId && <p className="text-xs text-gray-400 mt-0.5">Code cannot be changed.</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as System['type'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="source">Source</option>
                    <option value="target">Target</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Format</label>
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as System['format'] })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                    <option value="json">JSON</option>
                    <option value="xml">XML</option>
                    <option value="soap">SOAP</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Base URL (dev/local)</label>
                <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" placeholder="http://localhost:3020" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Base URL (production)</label>
                <input value={form.baseUrlProd} onChange={(e) => setForm({ ...form, baseUrlProd: e.target.value })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm" placeholder="https://api.example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Authentication</label>
                <select value={form.authMethod} onChange={(e) => setForm({ ...form, authMethod: e.target.value as AuthMethod })} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                  {AUTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {form.authMethod === 'basic' && (
                <div className="space-y-3 pl-2 border-l-2 border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                    <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Username" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={editingId ? 'Leave blank to keep current' : 'Password'} autoComplete="off" />
                  </div>
                </div>
              )}
              {form.authMethod === 'oauth2' && (
                <div className="space-y-3 pl-2 border-l-2 border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client ID</label>
                    <input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Client ID" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client Secret</label>
                    <input type="password" value={form.clientSecret} onChange={(e) => setForm({ ...form, clientSecret: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={editingId ? 'Leave blank to keep current' : 'Client secret'} autoComplete="off" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Token URL</label>
                    <input value={form.tokenUrl} onChange={(e) => setForm({ ...form, tokenUrl: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://auth.example.com/oauth/token" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isMock} onChange={(e) => setForm({ ...form, isMock: e.target.checked })} className="rounded border-gray-300" />
                  Mock system
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600" />
                  Active
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Systems
