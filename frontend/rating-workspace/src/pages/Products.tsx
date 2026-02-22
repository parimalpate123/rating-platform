import React from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { Package, Plus, ArrowRight, ExternalLink } from 'lucide-react'
import type { ProductLine } from '../api/products'
import { cn, statusColor, formatDate } from '../lib/utils'

interface OutletCtx {
  products: ProductLine[]
  reloadProducts: () => void
  onNewProduct?: () => void
}

function SystemChip({ label }: { label?: string }): React.ReactElement | null {
  if (!label) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
      {label}
    </span>
  )
}

export function Products() {
  const { products, onNewProduct } = useOutletContext<OutletCtx>()
  const navigate = useNavigate()

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Product Lines</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <button
          onClick={onNewProduct}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Product Line
        </button>
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
          <Package className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No product lines yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
            Create your first product line to start configuring rating pipelines.
          </p>
          <button
            onClick={onNewProduct}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product Line
          </button>
        </div>
      )}

      {/* Grid */}
      {products.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.code}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow flex flex-col gap-3"
            >
              {/* Code + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100 font-mono">{product.code}</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{product.name}</p>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 mt-1',
                    statusColor(product.status),
                  )}
                >
                  {product.status}
                </span>
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                  {product.description}
                </p>
              )}

              {/* Systems */}
              <div className="flex items-center gap-1.5">
                <SystemChip label={product.config?.sourceSystem} />
                {product.config?.sourceSystem && product.config?.targetSystem && (
                  <ArrowRight className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                )}
                <SystemChip label={product.config?.targetSystem} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatDate(product.createdAt)}
                </span>
                <button
                  onClick={() => navigate(`/products/${product.code}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition-colors"
                >
                  Open Workspace
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Products
