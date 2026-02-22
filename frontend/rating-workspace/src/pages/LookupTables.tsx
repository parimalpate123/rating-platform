import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Loader2, Database, RefreshCw, X } from 'lucide-react'
import { lookupTablesApi, type LookupTable, type LookupEntry } from '../api/lookupTables'
import { productsApi, type ProductLine } from '../api/products'
import { formatDate } from '../lib/utils'

// ── New table modal ───────────────────────────────────────────────────────────

function NewTableModal({
  products,
  onClose,
  onCreated,
}: {
  products: ProductLine[]
  onClose: () => void
  onCreated: (t: LookupTable) => void
}) {
  const [form, setForm] = useState({ name: '', productLineCode: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const t = await lookupTablesApi.create({
        name: form.name,
        productLineCode: form.productLineCode || undefined,
        description: form.description || undefined,
      })
      onCreated(t)
    } catch {
      setError('Failed to create table')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">New Lookup Table</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. state-surcharge-rates"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Product Line</label>
            <select
              value={form.productLineCode}
              onChange={(e) => setForm((p) => ({ ...p, productLineCode: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Global (all products)</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Table
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add entry modal ───────────────────────────────────────────────────────────

function AddEntryModal({
  tableId,
  onClose,
  onAdded,
}: {
  tableId: string
  onClose: () => void
  onAdded: (e: LookupEntry) => void
}) {
  const [key, setKey] = useState('')
  const [valueStr, setValueStr] = useState('{\n  \n}')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(valueStr)
    } catch {
      setError('Value must be valid JSON')
      return
    }
    setLoading(true)
    try {
      const entry = await lookupTablesApi.addEntry(tableId, { key, value: parsed })
      onAdded(entry)
    } catch {
      setError('Failed to add entry')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Add Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Key *</label>
            <input
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. NY"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Value (JSON) *</label>
            <textarea
              required
              rows={5}
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Entry
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Table row ─────────────────────────────────────────────────────────────────

function TableRow({
  table,
  onDelete,
}: {
  table: LookupTable
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [entries, setEntries] = useState<LookupEntry[]>(table.entries ?? [])
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDeleteEntry = async (entryId: string) => {
    setDeleting(entryId)
    try {
      await lookupTablesApi.deleteEntry(entryId)
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((p) => !p)}
      >
        <td className="px-3 py-3 text-gray-400 w-8">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{table.name}</td>
        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{table.productLineCode || <span className="text-gray-300">global</span>}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{table.description || <span className="text-gray-300">—</span>}</td>
        <td className="px-4 py-3 text-xs text-gray-400 text-center">{entries.length}</td>
        <td className="px-4 py-3 text-xs text-gray-400">{formatDate(table.createdAt)}</td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onDelete(table.id)}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Delete table"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} className="px-0 pb-0">
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Entries ({entries.length})</p>
                <button
                  onClick={() => setShowAddEntry(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Entry
                </button>
              </div>

              {entries.length === 0 ? (
                <p className="text-xs text-gray-400">No entries yet. Add key-value pairs to populate this table.</p>
              ) : (
                <div className="space-y-1.5">
                  {entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 bg-white rounded border border-gray-200 px-3 py-2 text-xs"
                    >
                      <span className="font-mono font-semibold text-gray-800 flex-shrink-0 w-24 truncate" title={entry.key}>
                        {entry.key}
                      </span>
                      <span className="text-gray-400">→</span>
                      <pre className="flex-1 text-gray-700 font-mono text-[11px] whitespace-pre-wrap break-all overflow-hidden">
                        {JSON.stringify(entry.value, null, 2)}
                      </pre>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        {deleting === entry.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}

      {showAddEntry && (
        <AddEntryModal
          tableId={table.id}
          onClose={() => setShowAddEntry(false)}
          onAdded={(e) => {
            setEntries((prev) => [...prev, e])
            setShowAddEntry(false)
          }}
        />
      )}
    </>
  )
}

// ── LookupTables page ─────────────────────────────────────────────────────────

export function LookupTables() {
  const [tables, setTables] = useState<LookupTable[]>([])
  const [products, setProducts] = useState<ProductLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productFilter, setProductFilter] = useState('')
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    lookupTablesApi
      .list(productFilter || undefined)
      .then(setTables)
      .catch(() => setError('Failed to load lookup tables'))
      .finally(() => setLoading(false))
  }, [productFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { productsApi.list().then(setProducts).catch(() => {}) }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lookup table and all its entries?')) return
    await lookupTablesApi.delete(id)
    setTables((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lookup Tables</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Key-value tables used by the <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">enrich</code> step type to merge data into rating context
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> New Table
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-5">
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All product lines</option>
          {products.map((p) => (
            <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
          ))}
        </select>
        {productFilter && (
          <button onClick={() => setProductFilter('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">{tables.length} table{tables.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      ) : tables.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Database className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No lookup tables yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Create lookup tables to enrich rating context — e.g., state surcharge rates, industry risk tiers.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create First Table
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entries</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tables.map((t) => (
                <TableRow key={t.id} table={t} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <NewTableModal
          products={products}
          onClose={() => setShowNew(false)}
          onCreated={(t) => {
            setTables((prev) => [t, ...prev])
            setShowNew(false)
          }}
        />
      )}
    </div>
  )
}

export default LookupTables
