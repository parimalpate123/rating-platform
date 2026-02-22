import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  XCircle,
  Circle,
  Settings,
  RefreshCw,
  Trash2,
  Play,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { productsApi, type ProductLine } from '../api/products'
import { cn, statusColor, formatDate } from '../lib/utils'
import { orchestratorApi, ratingApi, type ProductOrchestrator, type RateResponse } from '../api/orchestrator'
import { systemsApi, type System } from '../api/systems'
import { MappingsTab } from '../components/tabs/MappingsTab'
import { RulesTab } from '../components/tabs/RulesTab'
import { ScopesTab } from '../components/tabs/ScopesTab'
import { ExecutionFlowDiagram, type DiagramStep, type DiagramResult } from '../components/flow/ExecutionFlowDiagram'
import { StepDetailPanel } from '../components/flow/StepDetailPanel'
import { TestingFlowCircles } from '../components/flow/TestingFlowCircles'
import { ActivityFeed } from '../components/ActivityFeed'

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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit Product Line</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">{product.code}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800 resize-none"
            />
          </div>

          {/* Source + Target */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Source System</label>
              <select
                name="sourceSystem"
                value={form.sourceSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Target System</label>
              <select
                name="targetSystem"
                value={form.targetSystem}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Product Owner</label>
              <input
                name="productOwner"
                value={form.productOwner}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Technical Lead</label>
              <input
                name="technicalLead"
                value={form.technicalLead}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
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

const VALID_TABS = ['overview', 'orchestrator', 'mappings', 'rules', 'scopes'] as const

export function ProductDetail() {
  const { code, tab } = useParams<{ code: string; tab?: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductLine | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const activeTab = (tab && VALID_TABS.includes(tab as any)) ? tab : 'overview'
  const [showEdit, setShowEdit] = useState(false)

  const setActiveTabAndNavigate = (tabId: string) => {
    if (tabId === 'overview') {
      navigate(`/products/${code}`)
    } else {
      navigate(`/products/${code}/${tabId}`)
    }
  }

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
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
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
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{product.name}</h1>
              <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-mono font-semibold">
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{product.description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      {/* Info row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4">
        <div className="flex items-center flex-wrap gap-6">
          {/* Source → Target */}
          <div className="flex items-center gap-2">
            {product.config?.sourceSystem ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {product.config.sourceSystem}
              </span>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">No source</span>
            )}
            <ArrowRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
            {product.config?.targetSystem ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                {product.config.targetSystem}
              </span>
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">No target</span>
            )}
          </div>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

          {product.productOwner && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-gray-500 dark:text-gray-400">Owner:</span>
              {product.productOwner}
            </div>
          )}
          {product.technicalLead && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <Wrench className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <span className="font-medium text-gray-500 dark:text-gray-400">Lead:</span>
              {product.technicalLead}
            </div>
          )}

          <div className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            Created {formatDate(product.createdAt)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div>
        <div className="flex border-b border-gray-200 dark:border-gray-700 gap-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTabAndNavigate(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600',
              )}
            >
              {t.label}
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
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Product Details</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Code</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">{product.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Name</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{product.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</dt>
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
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Updated</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(product.updatedAt)}</dd>
          </div>
          {product.description && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Description
              </dt>
              <dd className="mt-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{product.description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Activity feed */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">Recent Activity</h3>
        <ActivityFeed productCode={product.code} />
      </div>
    </div>
  )
}

// --------------- Step type color map ---------------

const STEP_TYPE_COLORS: Record<string, string> = {
  validate_request: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  field_mapping: 'bg-blue-100 text-blue-700 border-blue-200',
  apply_rules: 'bg-green-100 text-green-700 border-green-200',
  format_transform: 'bg-orange-100 text-orange-700 border-orange-200',
  call_rating_engine: 'bg-purple-100 text-purple-700 border-purple-200',
  call_external_api: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  call_orchestrator: 'bg-teal-100 text-teal-700 border-teal-200',
  publish_event: 'bg-pink-100 text-pink-700 border-pink-200',
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

// --------------- Step types & config field definitions ---------------

const STEP_TYPES = [
  { value: 'validate_request', label: 'Validate Request' },
  { value: 'field_mapping', label: 'Field Mapping' },
  { value: 'apply_rules', label: 'Apply Rules' },
  { value: 'call_rating_engine', label: 'Call Rating Engine' },
  { value: 'format_transform', label: 'Format Transform' },
  { value: 'call_external_api', label: 'Call External API' },
  { value: 'publish_event', label: 'Publish Event' },
]

interface ConfigField {
  key: string
  label: string
  type: 'text' | 'select' | 'system-select'
  options?: string[]
  placeholder?: string
}

const STEP_CONFIG_FIELDS: Record<string, ConfigField[]> = {
  validate_request: [
    { key: 'schema', label: 'Schema Name', type: 'text', placeholder: 'e.g. rate-request, init-rate-request' },
    { key: 'strictMode', label: 'Strict Mode', type: 'select', options: ['true', 'false'] },
  ],
  field_mapping: [
    { key: 'direction', label: 'Direction', type: 'select', options: ['request', 'response'] },
    { key: 'mappingId', label: 'Mapping ID', type: 'text', placeholder: 'UUID of mapping' },
  ],
  apply_rules: [
    { key: 'scope', label: 'Scope', type: 'select', options: ['pre_rating', 'post_rating'] },
  ],
  call_rating_engine: [
    { key: 'systemCode', label: 'Target System', type: 'system-select' },
  ],
  format_transform: [
    { key: 'formatDirection', label: 'Format Direction', type: 'select', options: ['json_to_xml', 'xml_to_json'] },
  ],
  call_external_api: [
    { key: 'systemCode', label: 'System', type: 'system-select' },
    { key: 'endpoint', label: 'Endpoint Path', type: 'text', placeholder: '/v1/rate' },
    { key: 'method', label: 'HTTP Method', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'] },
  ],
  publish_event: [
    { key: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. rating.completed' },
  ],
}

function StepConfigForm({
  stepType,
  config,
  onChange,
  systems,
}: {
  stepType: string
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  systems: System[]
}) {
  const fields = STEP_CONFIG_FIELDS[stepType] ?? []
  if (fields.length === 0) return null

  const selectedSystem = systems.find(s => s.code === config['systemCode'])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
            {f.type === 'system-select' ? (
              <select
                value={(config[f.key] as string) ?? ''}
                onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select system...</option>
                {systems.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            ) : f.type === 'select' ? (
              <select
                value={(config[f.key] as string) ?? ''}
                onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select...</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                ))}
              </select>
            ) : (
              <input
                value={(config[f.key] as string) ?? ''}
                onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      {/* URL preview when a system is selected */}
      {selectedSystem && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
            <span>Base URL: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedSystem.baseUrl || '—'}</span></span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Auth: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedSystem.authMethod || 'none'}</span></span>
            <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
            <span>Format: <span className="font-medium text-gray-700 dark:text-gray-300">{selectedSystem.format}</span></span>
            {selectedSystem.isMock && (
              <>
                <span className="w-px h-3 bg-gray-300 dark:bg-gray-600" />
                <span className="px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">Mock</span>
              </>
            )}
          </div>
          {!!config['endpoint'] && (
            <div className="text-gray-500 dark:text-gray-400">
              Full URL: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedSystem.baseUrl}{config['endpoint'] as string}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --------------- OrchestratorTab ---------------

interface OrchestratorTabProps {
  productCode: string
  targetSystem: string
}

const FLOW_PAYLOADS: Record<string, object> = {
  rate: {
    policy: {
      insuredName: 'ACME Corporation',
      annualRevenue: 5000000,
      employeeCount: 50,
      state: 'NY',
      effectiveDate: new Date().toISOString().split('T')[0],
    },
    coverage: { type: 'BOP', limit: 1000000, deductible: 5000 },
    scope: { state: 'NY', transactionType: 'new_business' },
  },
  'init-rate': {
    policyNumber: 'POL-2026-001',
    productLineCode: '',
    transactionType: 'new_business',
    effectiveDate: new Date().toISOString().split('T')[0],
    requestedBy: 'system',
  },
  renew: {
    policyNumber: 'POL-2026-001',
    renewalDate: new Date().toISOString().split('T')[0],
    adjustments: {},
  },
  quote: {
    quoteId: '',
    applicant: { name: '', state: '' },
    coverages: [],
  },
}

function getDefaultPayload(endpointPath: string): string {
  const payload = FLOW_PAYLOADS[endpointPath] ?? { payload: {} }
  return JSON.stringify(payload, null, 2)
}

function OrchestratorTab({ productCode, targetSystem }: OrchestratorTabProps) {
  const [flows, setFlows] = useState<ProductOrchestrator[]>([])
  const [activeEndpoint, setActiveEndpoint] = useState<string>('rate')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [showNewFlowForm, setShowNewFlowForm] = useState(false)
  const [newFlowEndpoint, setNewFlowEndpoint] = useState('')
  const [newFlowName, setNewFlowName] = useState('')

  // Add step state
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepType, setNewStepType] = useState(STEP_TYPES[0].value)
  const [newStepName, setNewStepName] = useState('')
  const [newStepConfig, setNewStepConfig] = useState<Record<string, unknown>>({})

  // Edit step state (full config editing)
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editStepData, setEditStepData] = useState<{
    name: string; stepType: string; config: Record<string, unknown>; isActive: boolean
  }>({ name: '', stepType: '', config: {}, isActive: true })

  // Test panel state
  const [testPayload, setTestPayload] = useState(() => getDefaultPayload('rate'))
  const [testRunning, setTestRunning] = useState(false)
  const [testResult, setTestResult] = useState<RateResponse | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [selectedStep, setSelectedStep] = useState<{ step: DiagramStep; result?: DiagramResult } | null>(null)

  const orchestrator = flows.find(f => f.endpointPath === activeEndpoint) ?? null

  const load = () => {
    setLoading(true)
    setError(null)
    orchestratorApi
      .getAll(productCode)
      .then((data) => {
        setFlows(data)
        if (data.length > 0 && !data.find(f => f.endpointPath === activeEndpoint)) {
          setActiveEndpoint(data[0].endpointPath)
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load orchestrators.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    systemsApi.list().then(setSystems).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCode])

  const handleAutoGenerate = async (endpointPath = 'rate') => {
    const ts = targetSystem.toLowerCase()
    const targetFormat: 'xml' | 'json' =
      ts.includes('ratabase') || ts.includes('cgi') ? 'xml' : 'json'
    setGenerating(true)
    setError(null)
    try {
      await orchestratorApi.autoGenerate(productCode, targetFormat, endpointPath)
      load()
      setActiveEndpoint(endpointPath)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to auto-generate orchestrator.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteFlow = async () => {
    if (!orchestrator) return
    if (!confirm(`Delete the "${orchestrator.endpointPath}" flow? All steps will be removed.`)) return
    try {
      await orchestratorApi.deleteFlow(productCode, orchestrator.endpointPath)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete flow.')
    }
  }

  const handleCreateFlow = async () => {
    const ep = newFlowEndpoint.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (!ep) return
    try {
      await orchestratorApi.createFlow(productCode, newFlowName.trim() || `${productCode} ${ep} Flow`, ep)
      setShowNewFlowForm(false)
      setNewFlowEndpoint('')
      setNewFlowName('')
      setActiveEndpoint(ep)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create flow.')
    }
  }

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    if (!orchestrator) return
    if (!confirm(`Delete step "${stepName}"?`)) return
    try {
      await orchestratorApi.deleteStep(productCode, orchestrator.endpointPath, stepId)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete step.')
    }
  }

  const handleSaveStep = async (stepId: string) => {
    if (!editStepData.name.trim() || !orchestrator) return
    try {
      await orchestratorApi.updateStep(productCode, orchestrator.endpointPath, stepId, {
        name: editStepData.name.trim(),
        stepType: editStepData.stepType,
        config: editStepData.config,
        isActive: editStepData.isActive,
      })
      setEditingStepId(null)
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update step.')
    }
  }

  const handleAddStep = async () => {
    if (!newStepName.trim() || !orchestrator) return
    const nextOrder = orchestrator.steps.length > 0
      ? Math.max(...orchestrator.steps.map((s: { stepOrder: number }) => s.stepOrder)) + 1
      : 1
    try {
      await orchestratorApi.addStep(productCode, orchestrator.endpointPath, {
        stepType: newStepType,
        name: newStepName.trim(),
        config: newStepConfig,
        stepOrder: nextOrder,
      } as any)
      setShowAddStep(false)
      setNewStepName('')
      setNewStepType(STEP_TYPES[0].value)
      setNewStepConfig({})
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add step.')
    }
  }

  const handleRunTest = async () => {
    if (!orchestrator) return
    setTestRunning(true)
    setTestResult(null)
    setTestError(null)
    setExpandedSteps(new Set())
    try {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(testPayload)
      } catch {
        setTestError('Invalid JSON payload')
        setTestRunning(false)
        return
      }
      const res = await ratingApi.rate(
        productCode,
        parsed,
        undefined,
        orchestrator.endpointPath,
      )
      setTestResult(res)
    } catch (err: any) {
      setTestError(err?.response?.data?.message || err?.message || 'Rating request failed')
    } finally {
      setTestRunning(false)
    }
  }

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  // No flows at all
  if (flows.length === 0 && !showNewFlowForm) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
        <GitBranch className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">No Orchestrator Flows</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs mx-auto leading-relaxed mb-6">
          Create your first flow for this product line. Each flow maps to an endpoint (e.g. /rate, /init-rate).
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => handleAutoGenerate('rate')}
            disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Auto-Generate /rate Flow'}
          </button>
          <button
            onClick={() => setShowNewFlowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Custom Flow
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Flow selector tabs ── */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-1 flex-wrap">
          {flows.map(f => (
            <button
              key={f.endpointPath}
              onClick={() => { setActiveEndpoint(f.endpointPath); setTestPayload(getDefaultPayload(f.endpointPath)); setTestResult(null); setTestError(null); setSelectedStep(null) }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                activeEndpoint === f.endpointPath
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700',
              )}
            >
              /{f.endpointPath}
            </button>
          ))}
          <button
            onClick={() => setShowNewFlowForm(true)}
            className="px-2 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Flow
          </button>
        </div>
      </div>

      {/* ── New flow form ── */}
      {showNewFlowForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-5">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Create New Flow</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Endpoint Path</label>
              <input
                autoFocus
                value={newFlowEndpoint}
                onChange={e => setNewFlowEndpoint(e.target.value)}
                placeholder="e.g. init-rate, renew, quote"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
              <input
                value={newFlowName}
                onChange={e => setNewFlowName(e.target.value)}
                placeholder="e.g. Initiate Rating Flow"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateFlow}
              disabled={!newFlowEndpoint.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Create Empty Flow
            </button>
            <button
              onClick={() => { setShowNewFlowForm(false); setNewFlowEndpoint(''); setNewFlowName('') }}
              className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Selected flow content ── */}
      {orchestrator && (
        <>
          {/* Flow header card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center flex-shrink-0">
                <GitBranch className="w-[18px] h-[18px] text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{orchestrator.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">/{orchestrator.endpointPath} · {orchestrator.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border',
                orchestrator.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                  : orchestrator.status === 'draft' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600',
              )}>
                {orchestrator.status}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {orchestrator.steps.length} step{orchestrator.steps.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={handleDeleteFlow}
                className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                title="Delete this flow"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Flow diagram */}
          {orchestrator.steps.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Execution Flow</h3>
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">click a node to inspect</span>
              </div>
              <ExecutionFlowDiagram
                steps={orchestrator.steps}
                results={testResult?.stepResults.map((r) => ({
                  stepId: r.stepId,
                  stepName: r.stepName,
                  stepType: r.stepType,
                  status: r.status,
                  durationMs: r.durationMs,
                  error: r.error,
                  output: r.output,
                }))}
                onStepClick={(step, result) => setSelectedStep({ step, result })}
                selectedStepId={selectedStep?.step.id}
              />
            </div>
          )}

          {/* Steps list */}
          {orchestrator.steps.length === 0 && !showAddStep ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <Settings className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">No steps defined yet for /{orchestrator.endpointPath}.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleAutoGenerate(orchestrator.endpointPath)}
                  disabled={generating}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors disabled:opacity-60"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Auto-Generate Steps
                </button>
                <button
                  onClick={() => setShowAddStep(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step Manually
                </button>
              </div>
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
                    <div key={step.id} className={cn('bg-white dark:bg-gray-800 rounded-lg border px-5 py-4', isEditing ? 'border-blue-300 dark:border-blue-600 ring-1 ring-blue-100 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700')}>
                      <div className="flex items-center gap-4">
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{step.stepOrder}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', typeColor)}>
                              {step.stepType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{step.name}</span>
                          </div>
                          {!isEditing && preview && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">{preview}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {step.isActive ? <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 mr-1" aria-label="Active" /> : <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 mr-1" aria-label="Inactive" />}
                          <button
                            onClick={() => {
                              if (isEditing) {
                                setEditingStepId(null)
                              } else {
                                setEditingStepId(step.id)
                                setEditStepData({
                                  name: step.name,
                                  stepType: step.stepType,
                                  config: { ...(step.config ?? {}) },
                                  isActive: step.isActive,
                                })
                              }
                            }}
                            className={cn('p-1.5 rounded transition-colors', isEditing ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' : 'text-gray-300 dark:text-gray-600 hover:text-blue-600 dark:hover:text-blue-400')}
                            title={isEditing ? 'Close editor' : 'Edit step'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteStep(step.id, step.name)} className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors" title="Delete step"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {/* Expanded config editor */}
                      {isEditing && (
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step Name</label>
                              <input
                                autoFocus
                                value={editStepData.name}
                                onChange={(e) => setEditStepData(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step Type</label>
                              <select
                                value={editStepData.stepType}
                                onChange={(e) => setEditStepData(prev => ({ ...prev, stepType: e.target.value, config: {} }))}
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                {STEP_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <StepConfigForm
                            stepType={editStepData.stepType}
                            config={editStepData.config}
                            onChange={(c) => setEditStepData(prev => ({ ...prev, config: c }))}
                            systems={systems}
                          />

                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editStepData.isActive}
                                onChange={(e) => setEditStepData(prev => ({ ...prev, isActive: e.target.checked }))}
                                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                              />
                              Active
                            </label>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleSaveStep(step.id)}
                              disabled={!editStepData.name.trim()}
                              className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => setEditingStepId(null)}
                              className="px-4 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

              {/* Add Step button / form */}
              {showAddStep ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 ring-1 ring-blue-100 dark:ring-blue-800 px-5 py-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Add New Step</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step Name</label>
                      <input
                        autoFocus
                        value={newStepName}
                        onChange={(e) => setNewStepName(e.target.value)}
                        placeholder="e.g. Map Request Fields"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step Type</label>
                      <select
                        value={newStepType}
                        onChange={(e) => { setNewStepType(e.target.value); setNewStepConfig({}) }}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {STEP_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <StepConfigForm
                    stepType={newStepType}
                    config={newStepConfig}
                    onChange={setNewStepConfig}
                    systems={systems}
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleAddStep}
                      disabled={!newStepName.trim()}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      Add Step
                    </button>
                    <button
                      onClick={() => { setShowAddStep(false); setNewStepName(''); setNewStepType(STEP_TYPES[0].value); setNewStepConfig({}) }}
                      className="px-4 py-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddStep(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              )}
            </div>
          )}

          {/* ── Test Flow Panel ── */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Test /{orchestrator.endpointPath}</h3>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-mono">{productCode} · /{orchestrator.endpointPath} · {orchestrator.steps.length} step{orchestrator.steps.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="p-5 grid grid-cols-2 gap-5">
              {/* Left — inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Request Payload (JSON)</label>
                  <textarea
                    value={testPayload}
                    onChange={e => setTestPayload(e.target.value)}
                    rows={14}
                    className="w-full px-3 py-2 text-xs font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  onClick={handleRunTest}
                  disabled={testRunning || orchestrator.steps.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Running /{orchestrator.endpointPath}...</> : <><Play className="w-4 h-4" /> Run /{orchestrator.endpointPath}</>}
                </button>
              </div>

              {/* Right — results */}
              <div className="space-y-3">
                {testError && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {testError}
                  </div>
                )}

                {testResult && (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Result</span>
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', statusColor(testResult.status.toUpperCase()))}>
                          {testResult.status === 'completed' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {testResult.status}
                        </span>
                      </div>
                      {(testResult.response as any)?.premium && (
                        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded px-3 py-2">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium uppercase tracking-wide">Premium</p>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">${(testResult.response as any).premium.toLocaleString()}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Duration</span>
                          <p className="font-medium text-gray-700 dark:text-gray-300">{testResult.totalDurationMs}ms</p>
                        </div>
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Steps run</span>
                          <p className="font-medium text-gray-700 dark:text-gray-300">{testResult.stepResults.length}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-400 dark:text-gray-500">Transaction ID</span>
                          <p className="font-mono text-gray-700 dark:text-gray-300 truncate">{testResult.transactionId}</p>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Testing flow</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-2">Click a step to see request and response</p>
                      <TestingFlowCircles
                        steps={orchestrator.steps.map((s) => ({
                          id: s.id,
                          name: s.name,
                          stepType: s.stepType,
                          stepOrder: s.stepOrder,
                          config: s.config,
                        }))}
                        stepResults={testResult.stepResults}
                      />
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <p className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-700">Step Trace</p>
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {testResult.stepResults.map((step, i) => (
                          <div key={i}>
                            <button
                              onClick={() => toggleStep(i)}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                            >
                              <span className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400 flex-shrink-0">{i + 1}</span>
                              {step.status === 'completed'
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                              <span className="text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">{step.stepName}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">{step.durationMs}ms</span>
                              {expandedSteps.has(i) ? <ChevronDown className="w-3 h-3 text-gray-400 dark:text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />}
                            </button>
                            {expandedSteps.has(i) && (
                              <div className="px-3 pb-3 pt-1 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Type: <span className="font-mono">{step.stepType}</span></p>
                                {step.error && <p className="text-xs text-red-600 dark:text-red-400">Error: {step.error}</p>}
                                {step.output && (
                                  <pre className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 mt-1 overflow-auto max-h-28">
                                    {JSON.stringify(step.output, null, 2)}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {!testResult && !testError && !testRunning && (
                  <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
                    <Zap className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 dark:text-gray-500">Results will appear here after running a test</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedStep && (
            <StepDetailPanel
              step={selectedStep.step}
              result={selectedStep.result}
              onClose={() => setSelectedStep(null)}
            />
          )}
        </>
      )}

      {/* No flow selected but flows exist */}
      {!orchestrator && flows.length > 0 && !showNewFlowForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Select a flow tab above to view its configuration.</p>
        </div>
      )}
    </div>
  )
}

export default ProductDetail
