import React, { useState, useEffect } from 'react'
import { Loader2, Plus, X, Layers } from 'lucide-react'
import { scopesApi, type ProductScope, type ScopeType } from '../../api/scopes'

// ── Scope Column ─────────────────────────────────────────────────────────────

function ScopeColumn({
  title,
  scopeType,
  scopes,
  productCode,
  onChanged,
}: {
  title: string
  scopeType: ScopeType
  scopes: ProductScope[]
  productCode: string
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!newValue.trim()) return
    setSaving(true)
    try {
      await scopesApi.create(productCode, { scopeType, scopeValue: newValue.trim() })
      setNewValue('')
      setAdding(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    await scopesApi.delete(productCode, id)
    onChanged()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
    if (e.key === 'Escape') { setAdding(false); setNewValue('') }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          <span className="text-xs text-gray-400">{scopes.length}</span>
        </div>
      </div>

      {/* Values */}
      <div className="flex-1 px-4 py-3 space-y-1.5 min-h-[120px]">
        {scopes.length === 0 && !adding && (
          <p className="text-xs text-gray-400 text-center py-4">No values yet</p>
        )}

        {scopes.map((scope) => (
          <div key={scope.id} className="flex items-center justify-between">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
              {scope.scopeValue}
            </span>
            <button
              onClick={() => handleDelete(scope.id)}
              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-2.5 py-1.5 text-xs border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              placeholder={scopeType === 'state' ? 'e.g. NY' : scopeType === 'coverage' ? 'e.g. BOP' : 'e.g. new_business'}
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newValue.trim()}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setAdding(false); setNewValue('') }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Add button */}
      {!adding && (
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add {title.slice(0, -1)}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ScopesTab({ productCode }: { productCode: string }) {
  const [scopes, setScopes] = useState<ProductScope[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadScopes = () => {
    setLoading(true)
    scopesApi
      .list(productCode)
      .then(setScopes)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load scopes'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadScopes() }, [productCode])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
  }

  const states = scopes.filter((s) => s.scopeType === 'state')
  const coverages = scopes.filter((s) => s.scopeType === 'coverage')
  const txTypes = scopes.filter((s) => s.scopeType === 'transaction_type')

  const totalCount = scopes.length

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">
          {totalCount} scope value{totalCount !== 1 ? 's' : ''} defined.
          {totalCount === 0 && ' Add states, coverages, and transaction types to control when rules fire.'}
        </p>
      </div>

      {totalCount === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          <strong>How scopes work:</strong> Define the valid values here (e.g., states like NY, CA). Then when creating rules, you can tag them with specific scopes so they only fire for matching requests.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <ScopeColumn title="States" scopeType="state" scopes={states} productCode={productCode} onChanged={loadScopes} />
        <ScopeColumn title="Coverages" scopeType="coverage" scopes={coverages} productCode={productCode} onChanged={loadScopes} />
        <ScopeColumn title="Transaction Types" scopeType="transaction_type" scopes={txTypes} productCode={productCode} onChanged={loadScopes} />
      </div>
    </div>
  )
}
