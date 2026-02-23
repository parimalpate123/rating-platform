import React from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Package,
  Server,
  Activity,
  ArrowRight,
  Plus,
  BarChart3,
} from 'lucide-react'
import type { ProductLine } from '../api/products'
import { cn } from '../lib/utils'

interface OutletCtx {
  products: ProductLine[]
  reloadProducts: () => void
}

interface StatCardProps {
  label: string
  value: string | number
  borderColor: string
}

function StatCard({ label, value, borderColor }: StatCardProps) {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 border-l-4', borderColor)}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}

interface NavCardProps {
  icon: React.ElementType
  title: string
  description: string
  borderColor: string
  onClick: () => void
}

function NavCard({ icon: Icon, title, description, borderColor, onClick }: NavCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 border-l-4 p-5 text-left w-full',
        'hover:shadow-md transition-shadow group',
        borderColor,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
            <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors flex-shrink-0 mt-1" />
      </div>
    </button>
  )
}

export function Dashboard() {
  const { products } = useOutletContext<OutletCtx>()
  const navigate = useNavigate()

  const activeCount = products.filter((p) => p.status === 'active').length

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-8">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Rating Orchestration Platform</p>
      </div>

      {/* Stats row — Rules removed (per-product); Systems highlighted */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Product Lines"
          value={products.length}
          borderColor="border-l-blue-500"
        />
        <StatCard
          label="Active Products"
          value={activeCount}
          borderColor="border-l-green-500"
        />
        <StatCard
          label="Systems"
          value="5 registered"
          borderColor="border-l-purple-500"
        />
      </div>

      {/* Your Platform */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
          Your Platform
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <NavCard
            icon={Package}
            title="Product Lines"
            description="Manage rating product configurations"
            borderColor="border-l-yellow-400"
            onClick={() => navigate('/products')}
          />
          <NavCard
            icon={Server}
            title="Systems Registry"
            description="Source and target system connections"
            borderColor="border-l-blue-500"
            onClick={() => navigate('/systems')}
          />
          <NavCard
            icon={BarChart3}
            title="Insights"
            description="Search transactions and analyze execution flow"
            borderColor="border-l-green-500"
            onClick={() => navigate('/insights')}
          />
          <NavCard
            icon={Activity}
            title="Transactions"
            description="Monitor rating request execution"
            borderColor="border-l-purple-500"
            onClick={() => navigate('/transactions')}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Product Line
          </button>
          <button
            onClick={() => navigate('/architecture')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            View Architecture
          </button>
        </div>
      </div>

      {/* Empty state */}
      {products.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <Package className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No product lines yet.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Create your first product line to get started.
          </p>
          <button
            onClick={() => navigate('/products')}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        </div>
      )}
    </div>
  )
}

export default Dashboard
