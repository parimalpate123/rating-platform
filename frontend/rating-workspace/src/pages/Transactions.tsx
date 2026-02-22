import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Activity, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react'
import { transactionsApi, type Transaction, type StepLog } from '../api/transactions'
import { cn, statusColor, formatDate } from '../lib/utils'
import { ExecutionFlowDiagram, type DiagramStep, type DiagramResult } from '../components/flow/ExecutionFlowDiagram'
import { StepDetailPanel } from '../components/flow/StepDetailPanel'

// ── Step status icon ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'FAILED') return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  return <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
}

// ── Expanded step logs row ────────────────────────────────────────────────────

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
        <td colSpan={8} className="px-6 py-3 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
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
        <td colSpan={8} className="px-6 py-3 bg-red-50 dark:bg-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
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
    output: log.outputSnapshot,
    startedAt: log.startedAt,
    completedAt: log.completedAt,
  }))

  return (
    <>
      <tr>
        <td colSpan={8} className="px-0 pb-0">
          <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 px-6 py-4 space-y-4">
            {steps.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">No step logs available.</p>
            ) : (
              <>
                {/* Flow diagram */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
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
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
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
                          <span className="ml-2 text-gray-400 text-[11px] font-mono">{step.stepType}</span>
                          {step.errorMessage && (
                            <p className="text-red-500 dark:text-red-400 text-[11px] mt-0.5 truncate">{step.errorMessage}</p>
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
                          <span className="text-gray-400 dark:text-gray-500 text-[11px] flex-shrink-0 font-mono">
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

// ── Transactions page ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: Transaction['status'][] = [
  'RECEIVED',
  'VALIDATING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]

export function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    transactionsApi
      .list({ productLineCode: productFilter || undefined, status: statusFilter || undefined })
      .then(setTransactions)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load transactions.')
      })
      .finally(() => setLoading(false))
  }, [productFilter, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasFilters = productFilter || statusFilter

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Monitor rating request execution across all product lines
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <input
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          placeholder="Filter by product line..."
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 w-52"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setProductFilter(''); setStatusFilter('') }}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
          <Activity className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {hasFilters ? 'No transactions match the current filters' : 'No transactions yet'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
            {!hasFilters && 'Transactions appear here after executing a rating request through the orchestrator.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="w-8 px-3 py-3" />
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Correlation ID
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Scope
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Premium
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Steps
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Duration · Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {transactions.map((tx) => (
                <React.Fragment key={tx.id}>
                  <tr
                    onClick={() => toggleExpand(tx.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-3 text-gray-400 dark:text-gray-500">
                      {expanded.has(tx.id) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[130px]">
                      <span title={tx.correlationId} className="truncate block">
                        {tx.correlationId.length > 18
                          ? `${tx.correlationId.slice(0, 8)}…${tx.correlationId.slice(-4)}`
                          : tx.correlationId}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
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
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {tx.scope ? (
                        <span className="space-x-1">
                          {tx.scope.state && <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium">{tx.scope.state}</span>}
                          {tx.scope.coverage && <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-medium">{tx.scope.coverage}</span>}
                          {tx.scope.transactionType && <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded text-[10px]">{tx.scope.transactionType}</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {tx.premiumResult != null ? (
                        <span className="font-semibold text-green-700 dark:text-green-300">${Number(tx.premiumResult).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                      {tx.completedSteps}/{tx.stepCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                      <div>
                        {tx.durationMs != null ? (
                          <span className="font-mono text-gray-600 dark:text-gray-400">{tx.durationMs}ms</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </div>
                      <div>{formatDate(tx.createdAt)}</div>
                    </td>
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
