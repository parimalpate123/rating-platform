import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  ArrowRight,
  Pencil,
  Loader2,
  X,
  GitBranch,
  User,
  Wrench,
  Zap,
  CheckCircle,
  Circle,
  Settings,
  RefreshCw,
  Trash2,
  Check,
} from 'lucide-react'
import { productsApi, type ProductLine } from '../api/products'
import { cn, statusColor, formatDate } from '../lib/utils'
import { orchestratorApi, type ProductOrchestrator } from '../api/orchestrator'
import { MappingsTab } from '../components/tabs/MappingsTab'
import { RulesTab } from '../components/tabs/RulesTab'
import { ScopesTab } from '../components/tabs/ScopesTab'

// --------------- Edit Modal ---------------

interface EditProductModalProps {
  product: ProductLine
  onClose: () => void
  onUpdated: (updated: ProductLine) => void
}

const SOURCE_SYSTEMS = [
  { value: 'gw-policycenter', label: 'GW PolicyCenter' },
  { value: 'duck-creek', label: 'Duck Creek' },
  { value: 'salesforce', label: 'Salesforce' },
  { value: 'manual', label: 'Manual' },
]

const TARGET_SYSTEMS = [
  { value: 'cgi-ratabase', label: 'CGI Ratabase' },
  { value: 'earnix', label: 'Earnix' },
  { value: 'custom', label: 'Custom' },
]

function EditProductModal({ product, onClose, onUpdated }: EditProductModalProps) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? '',
    sourceSystem: product.config?.sourceSystem ?? '',
    targetSystem: product.config?.targetSystem ?? '',
    productOwner: product.productOwner ?? '',
    technicalLead: product.technicalLead ?? '',
    status: product.status,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updated = await productsApi.update(product.code, {
        name: form.name,
        description: form.description || undefined,
        productOwner: form.productOwner || undefined,
        technicalLead: form.technicalLead || undefined,
        status: form.status as ProductLine['status'],
        config: {
          ...product.config,
          sourceSystem: form.sourceSystem || undefined,
          targetSystem: form.targetSystem || undefined,
        },
      })
      onUpdated(updated)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to update product line.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Edit Product Line</h2>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{product.code}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white resize-none"
            />
          </div>

          {/* Source + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Source System</label>
              <select
                name="sourceSystem"
                value={form.sourceSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              >
                <option value="">Select source...</option>
                {SOURCE_SYSTEMS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Target System</label>
              <select
                name="targetSystem"
                value={form.targetSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              >
                <option value="">Select target...</option>
                {TARGET_SYSTEMS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Owner + Lead */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Owner</label>
              <input
                name="productOwner"
                value={form.productOwner}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Technical Lead</label>
              <input
                name="technicalLead"
                value={form.technicalLead}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --------------- Tab definitions ---------------

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orchestrator', label: 'Orchestrator' },
  { id: 'mappings', label: 'Mappings' },
  { id: 'rules', label: 'Rules' },
  { id: 'scopes', label: 'Scopes' },
]

// --------------- Main ProductDetail ---------------

export function ProductDetail() {
  const { code } = useParams<{ code: string }>()
  const [product, setProduct] = useState<ProductLine | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showEdit, setShowEdit] = useState(false)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setError(null)
    productsApi
      .get(code)
      .then(setProduct)
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : 'Failed to load product details.'
        )
      })
      .finally(() => setLoading(false))
  }, [code])

  if (loading) {
    return (
      <div className="px-6 py-6 flex items-center justify-center min-h-48">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error ?? 'Product not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{product.name}</h1>
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs font-mono font-semibold">
                {product.code}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  statusColor(product.status),
                )}
              >
                {product.status}
              </span>
            </div>
            {product.description && (
              <p className="text-sm text-gray-500 mt-1">{product.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* Info row */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
        <div className="flex items-center flex-wrap gap-6">
          {/* Source → Target */}
          <div className="flex items-center gap-2">
            {product.config?.sourceSystem ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {product.config.sourceSystem}
              </span>
            ) : (
              <span className="text-xs text-gray-400">No source</span>
            )}
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
            {product.config?.targetSystem ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                {product.config.targetSystem}
              </span>
            ) : (
              <span className="text-xs text-gray-400">No target</span>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {product.productOwner && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-500">Owner:</span>
              {product.productOwner}
            </div>
          )}
          {product.technicalLead && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <Wrench className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-gray-500">Lead:</span>
              {product.technicalLead}
            </div>
          )}

          <div className="ml-auto text-xs text-gray-400">
            Created {formatDate(product.createdAt)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-gray-200 gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {activeTab === 'overview' && <OverviewTab product={product} />}
          {activeTab === 'orchestrator' && (
            <OrchestratorTab
              productCode={product.code}
              targetSystem={product.config?.targetSystem as string ?? ''}
            />
          )}
          {activeTab === 'mappings' && (
            <MappingsTab
              productCode={product.code}
              sourceSystem={product.config?.sourceSystem ?? ''}
              targetSystem={product.config?.targetSystem ?? ''}
            />
          )}
          {activeTab === 'rules' && <RulesTab productCode={product.code} />}
          {activeTab === 'scopes' && <ScopesTab productCode={product.code} />}
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <EditProductModal
          product={product}
          onClose={() => setShowEdit(false)}
          onUpdated={(updated) => {
            setProduct(updated)
            setShowEdit(false)
          }}
        />
      )}
    </div>
  )
}

function OverviewTab({ product }: { product: ProductLine }) {
  return (
    <div className="space-y-4">
      {/* Details card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Product Details</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Code</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono">{product.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</dt>
            <dd className="mt-1 text-sm text-gray-900">{product.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</dt>
            <dd className="mt-1">
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  statusColor(product.status),
                )}
              >
                {product.status}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Updated</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(product.updatedAt)}</dd>
          </div>
          {product.description && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Description
              </dt>
              <dd className="mt-1 text-sm text-gray-700 leading-relaxed">{product.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Orchestrator placeholder */}
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center bg-gray-50">
        <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">Orchestrator Flow</p>
        <p className="text-xs text-gray-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
          Orchestrator configuration coming in Phase 2 — connect services to see the live execution
          flow.
        </p>
      </div>
    </div>
  )
}

// --------------- Step type color map ---------------

const STEP_TYPE_COLORS: Record<string, string> = {
  field_mapping: 'bg-blue-100 text-blue-700 border-blue-200',
  apply_rules: 'bg-green-100 text-green-700 border-green-200',
  format_transform: 'bg-orange-100 text-orange-700 border-orange-200',
  call_rating_engine: 'bg-purple-100 text-purple-700 border-purple-200',
  call_external_api: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  call_orchestrator: 'bg-teal-100 text-teal-700 border-teal-200',
  publish_event: 'bg-pink-100 text-pink-700 border-pink-200',
  enrich: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const CONFIG_PREVIEW_KEYS = ['direction', 'systemCode', 'formatDirection', 'format', 'engine', 'url', 'event']

function stepConfigPreview(config: Record<string, unknown>): string {
  const parts: string[] = []
  for (const key of CONFIG_PREVIEW_KEYS) {
    if (config[key] !== undefined && config[key] !== null && config[key] !== '') {
      parts.push(`${key}: ${config[key]}`)
    }
  }
  if (parts.length === 0) {
    const entries = Object.entries(config).slice(0, 2)
    for (const [k, v] of entries) {
      parts.push(`${k}: ${v}`)
    }
  }
  return parts.join('  ·  ')
}

// --------------- OrchestratorTab ---------------

interface OrchestratorTabProps {
  productCode: string
  targetSystem: string
}

function OrchestratorTab({ productCode, targetSystem }: OrchestratorTabProps) {
  const [orchestrator, setOrchestrator] = useState<ProductOrchestrator | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    orchestratorApi
      .get(productCode)
      .then((data) => { setOrchestrator(data) })
      .catch((err: unknown) => {
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined
        if (status === 404) setNotFound(true)
        else setError(err instanceof Error ? err.message : 'Failed to load orchestrator.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCode])

  const handleAutoGenerate = async () => {
    const ts = targetSystem.toLowerCase()
    const targetFormat: 'xml' | 'json' =
      ts.includes('ratabase') || ts.includes('cgi') ? 'xml' : 'json'
    setGenerating(true)
    setError(null)
    try {
      const data = await orchestratorApi.autoGenerate(productCode, targetFormat)
      setOrchestrator(data)
      setNotFound(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to auto-generate orchestrator.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteOrchestrator = async () => {
    if (!confirm('Delete this orchestrator? All steps will be removed. You can re-generate it after.')) return
    try {
      await orchestratorApi.delete(productCode)
      setOrchestrator(null)
      setNotFound(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete orchestrator.')
    }
  }

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    if (!confirm(`Delete step "${stepName}"?`)) return
    try {
      await orchestratorApi.deleteStep(productCode, stepId)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete step.')
    }
  }

  const handleSaveStep = async (stepId: string) => {
    if (!editName.trim()) return
    try {
      await orchestratorApi.updateStep(productCode, stepId, { name: editName.trim() })
      setEditingStepId(null)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update step.')
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (notFound || !orchestrator) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <GitBranch className="w-10 h-10 text-gray-300 mx-auto mb-4" />
        <p className="text-sm font-semibold text-gray-600 mb-1">No Orchestrator Configured</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed mb-6">
          There is no orchestrator flow for this product line yet. Auto-generate one based on the
          target system configuration.
        </p>
        <button
          onClick={handleAutoGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : 'Auto-Generate Flow'}
        </button>
      </div>
    )
  }

  const statusBadgeClass =
    orchestrator.status === 'active'
      ? 'bg-green-100 text-green-700 border-green-200'
      : orchestrator.status === 'draft'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
      : 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div className="space-y-4">
      {/* Orchestrator header card */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <GitBranch className="w-[18px] h-[18px] text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{orchestrator.name}</p>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{orchestrator.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border', statusBadgeClass)}>
            {orchestrator.status}
          </span>
          <span className="text-xs text-gray-400">
            {orchestrator.steps.length} step{orchestrator.steps.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={handleDeleteOrchestrator}
            className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors"
            title="Delete orchestrator"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps list */}
      {orchestrator.steps.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Settings className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No steps defined yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...orchestrator.steps]
            .sort((a, b) => a.stepOrder - b.stepOrder)
            .map((step) => {
              const typeColor =
                STEP_TYPE_COLORS[step.stepType] ?? 'bg-gray-100 text-gray-600 border-gray-200'
              const preview = stepConfigPreview(step.config ?? {})
              const isEditing = editingStepId === step.id
              return (
                <div key={step.id} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Step number */}
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-gray-600">{step.stepOrder}</span>
                    </div>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveStep(step.id); if (e.key === 'Escape') setEditingStepId(null) }}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', typeColor)}>
                              {step.stepType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm font-medium text-gray-800 truncate">{step.name}</span>
                          </div>
                          {preview && <p className="text-xs text-gray-400 mt-1 truncate">{preview}</p>}
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSaveStep(step.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingStepId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded" title="Cancel"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          {step.isActive ? <CheckCircle className="w-4 h-4 text-green-500 mr-1" title="Active" /> : <Circle className="w-4 h-4 text-gray-300 mr-1" title="Inactive" />}
                          <button onClick={() => { setEditingStepId(step.id); setEditName(step.name) }} className="p-1.5 text-gray-300 hover:text-blue-600 rounded transition-colors" title="Rename step"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteStep(step.id, step.name)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition-colors" title="Delete step"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

export default ProductDetail
