import React, { useState } from 'react'
import { X } from 'lucide-react'
import { productsApi } from '../api/products'
import { cn } from '../lib/utils'

interface NewProductModalProps {
  onClose: () => void
  onCreated: () => void
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

export function NewProductModal({ onClose, onCreated }: NewProductModalProps) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    sourceSystem: '',
    targetSystem: '',
    productOwner: '',
    technicalLead: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await productsApi.create({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        productOwner: form.productOwner || undefined,
        technicalLead: form.technicalLead || undefined,
        config: {
          sourceSystem: form.sourceSystem || undefined,
          targetSystem: form.targetSystem || undefined,
        },
      })
      onCreated()
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to create product line. Please try again.'
      setError(msg)
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
            <h2 className="text-base font-semibold text-gray-900">New Product Line</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create a new rating product line</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Code + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Code <span className="text-red-500">*</span>
              </label>
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                required
                placeholder="e.g. GL, IMCE"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="e.g. General Liability"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
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
              placeholder="Brief description of this product line..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white resize-none"
            />
          </div>

          {/* Source + Target System */}
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

          {/* Product Owner + Technical Lead */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Product Owner</label>
              <input
                name="productOwner"
                value={form.productOwner}
                onChange={handleChange}
                placeholder="e.g. Jane Smith"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Technical Lead</label>
              <input
                name="technicalLead"
                value={form.technicalLead}
                onChange={handleChange}
                placeholder="e.g. John Doe"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Actions */}
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
              className={cn(
                'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2',
              )}
            >
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Creating...' : 'Create Product Line'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
