import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Activity, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { transactionsApi, type Transaction, type StepLog } from '../api/transactions'
import { cn, statusColor, formatDate } from '../lib/utils'
import { ExecutionFlowDiagram, type DiagramStep, type DiagramResult } from '../components/flow/ExecutionFlowDiagram'
import { StepDetailPanel } from '../components/flow/StepDetailPanel'

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'FAILED') return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  return <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
}

function StepLogsRow({ txId }: { txId: string }) {
  const [steps, setSteps] = useState<StepLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<{ step: DiagramStep; result?: DiagramResult } | null>(null)

  useEffect(() => {
    transactionsApi
      .getSteps(txId)
      .then(setSteps)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load steps.')
      })
      .finally(() => setLoading(false))
  }, [txId])

  if (loading) {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-3 bg-gray-50">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading step logs...
          </div>
        </td>
      </tr>
    )
  }

  if (error) {
    return (
      <tr>
        <td colSpan={7} className="px-6 py-3 bg-red-50">
          <p className="text-xs text-red-600">{error}</p>
        </td>
      </tr>
    )
  }

  const derivedSteps: DiagramStep[] = steps.map((log) => ({
    id: log.id,
    name: log.stepName,
    stepType: log.stepType,
    stepOrder: log.stepOrder,
  }))

  const derivedResults: DiagramResult[] = steps.map((log) => ({
    stepId: log.id,
    status: log.status,
    durationMs: log.durationMs,
    error: log.errorMessage,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
  }))

  return (
    <>
      <tr>
        <td colSpan={7} className="px-0 pb-0">
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 space-y-4">
            {steps.length === 0 ? (
              <p className="text-xs text-gray-400">No step logs available.</p>
            ) : (
              <>
                {/* Flow diagram */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Execution Flow · click a node to inspect
                  </p>
                  <ExecutionFlowDiagram
                    steps={derivedSteps}
                    results={derivedResults}
                    onStepClick={(step, result) => setSelectedStep({ step, result })}
                    selectedStepId={selectedStep?.step.id}
                  />
                </div>

                {/* Step list */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Step Logs
                  </p>
                  <div className="space-y-1.5">
                    {steps.map((step) => (
                      <div
                        key={step.id}
                        className="flex items-center gap-3 text-xs text-gray-700 bg-white rounded border border-gray-200 px-3 py-2"
                      >
                        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 font-mono text-[10px] flex-shrink-0">
                          {step.stepOrder}
                        </span>
                        <StepStatusIcon status={step.status} />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-800">{step.stepName}</span>
                          <span className="ml-2 text-gray-400 text-[11px]">{step.stepType}</span>
                          {step.errorMessage && (
                            <p className="text-red-500 text-[11px] mt-0.5 truncate">{step.errorMessage}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                            statusColor(step.status),
                          )}
                        >
                          {step.status}
                        </span>
                        {step.durationMs != null && (
                          <span className="text-gray-400 text-[11px] flex-shrink-0">
                            {step.durationMs}ms
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </td>
      </tr>
      {selectedStep &&
        createPortal(
          <StepDetailPanel
            step={selectedStep.step}
            result={selectedStep.result}
            onClose={() => setSelectedStep(null)}
          />,
          document.body,
        )}
    </>
  )
}

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Filters
  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    transactionsApi
      .list()
      .then(setTransactions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load transactions.')
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const filtered = transactions.filter((tx) => {
    const matchProduct =
      !productFilter ||
      tx.productLineCode.toLowerCase().includes(productFilter.toLowerCase())
    const matchStatus = !statusFilter || tx.status === statusFilter
    return matchProduct && matchStatus
  })

  const STATUS_OPTIONS: Transaction['status'][] = [
    'RECEIVED',
    'VALIDATING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
  ]

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitor rating request execution across all product lines
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          placeholder="Filter by product line..."
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-56"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {(productFilter || statusFilter) && (
          <button
            onClick={() => { setProductFilter(''); setStatusFilter('') }}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {transactions.length} transactions
        </span>
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

      {/* Empty state */}
      {!loading && transactions.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No transactions yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Transactions appear here after executing a rating request through the orchestrator API.
          </p>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && transactions.length > 0 && filtered.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-500">No transactions match the current filters.</p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Correlation ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Steps
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Duration
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((tx) => (
                <React.Fragment key={tx.id}>
                  <tr
                    onClick={() => toggleExpand(tx.id)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-3 text-gray-400">
                      {expanded.has(tx.id) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[140px]">
                      <span title={tx.correlationId} className="truncate block">
                        {tx.correlationId.length > 20
                          ? `${tx.correlationId.slice(0, 8)}...${tx.correlationId.slice(-4)}`
                          : tx.correlationId}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800">
                      {tx.productLineCode}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          statusColor(tx.status),
                        )}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {tx.completedSteps}/{tx.stepCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {tx.durationMs != null ? `${tx.durationMs}ms` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(tx.createdAt)}</td>
                  </tr>
                  {expanded.has(tx.id) && <StepLogsRow txId={tx.id} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Transactions
