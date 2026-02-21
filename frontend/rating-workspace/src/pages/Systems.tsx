import React, { useState, useEffect } from 'react'
import { Loader2, Server, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { systemsApi, type System } from '../api/systems'
import { cn } from '../lib/utils'

function TypeBadge({ type }: { type: System['type'] }): React.ReactElement {
  const styles: Record<System['type'], string> = {
    source: 'bg-blue-50 text-blue-700 border-blue-200',
    target: 'bg-green-50 text-green-700 border-green-200',
    both: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        styles[type],
      )}
    >
      {type}
    </span>
  )
}

function FormatBadge({ format }: { format: System['format'] }) {
  const styles: Record<System['format'], string> = {
    json: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    xml: 'bg-orange-50 text-orange-700 border-orange-200',
    soap: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        styles[format],
      )}
    >
      {format.toUpperCase()}
    </span>
  )
}

type HealthState = 'idle' | 'checking' | 'healthy' | 'error'

function HealthCheckCell({ systemId }: { systemId: string }) {
  const [state, setState] = useState<HealthState>('idle')

  const check = async () => {
    setState('checking')
    try {
      await systemsApi.healthCheck(systemId)
      setState('healthy')
    } catch {
      setState('error')
    }
  }

  if (state === 'idle') {
    return (
      <button
        onClick={check}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <RefreshCw className="w-3 h-3" />
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
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <CheckCircle className="w-3.5 h-3.5" />
        Healthy
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-red-600">
      <AlertCircle className="w-3.5 h-3.5" />
      Error
    </div>
  )
}

export function Systems() {
  const [systems, setSystems] = useState<System[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    systemsApi
      .list()
      .then(setSystems)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load systems.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Systems Registry</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage source and target systems used across product lines
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      )}

      {/* Empty */}
      {!loading && systems.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Server className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No systems registered yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Systems will appear here once configured in the backend.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && systems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Code
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Format
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Protocol
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  URL
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Mock
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Health
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {systems.map((sys) => (
                <tr key={sys.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{sys.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{sys.code}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={sys.type} />
                  </td>
                  <td className="px-4 py-3">
                    <FormatBadge format={sys.format} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 uppercase">{sys.protocol}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">
                    {sys.baseUrl ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {sys.isMock ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        Mock
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        sys.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500',
                      )}
                    >
                      {sys.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthCheckCell systemId={sys.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Systems
