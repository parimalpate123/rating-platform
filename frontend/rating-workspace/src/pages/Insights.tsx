import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Copy,
} from 'lucide-react'
import { transactionsApi, type Transaction, type StepLog } from '../api/transactions'
import { cn, statusColor, formatDate } from '../lib/utils'
import {
  ExecutionFlowDiagram,
  type DiagramStep,
  type DiagramResult,
  getServiceLabel,
} from '../components/flow/ExecutionFlowDiagram'
import { StepDetailPanel } from '../components/flow/StepDetailPanel'

// ── Step status icon ──────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (status === 'FAILED') return <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  return <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
}

// ── JSON viewer with copy ──────────────────────────────────────────────────────

function JsonViewer({ data, label, defaultOpen = false }: { data: unknown; label: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)
  const str = data != null ? JSON.stringify(data, null, 2) : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(str).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            {copied ? 'Copied' : 'Copy'}
          </button>
          <pre className="p-3 pt-9 text-xs font-mono text-gray-700 dark:text-gray-300 overflow-auto max-h-64">
            {str || <span className="text-gray-400 dark:text-gray-500 italic">Empty</span>}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Expanded detail row ────────────────────────────────────────────────────────

function InsightDetailRow({
  tx,
  steps,
  loading,
}: {
  tx: Transaction
  steps: StepLog[]
  loading?: boolean
}) {
  const [selectedStep, setSelectedStep] = useState<{ step: DiagramStep; result?: DiagramResult } | null>(null)

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

  if (loading) {
    return (
      <tr>
        <td colSpan={9} className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading step logs...
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <tr>
        <td colSpan={9} className="px-0 pb-0">
          <div className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-3 min-w-0">
            {/* Request & Response JSON */}
            <div className="grid grid-cols-2 gap-3">
              <JsonViewer
                data={tx.requestPayload}
                label="Request Payload (JSON)"
                defaultOpen
              />
              <JsonViewer
                data={tx.responsePayload}
                label="Response Payload (JSON)"
                defaultOpen
              />
            </div>

            {/* Step trace flowchart — scrollable so all steps are visible */}
            {steps.length > 0 && (
              <div className="min-w-0 max-w-full">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Step Trace · click a node to inspect
                </p>
                <ExecutionFlowDiagram
                  steps={derivedSteps}
                  results={derivedResults}
                  onStepClick={(step, result) => setSelectedStep({ step, result })}
                  selectedStepId={selectedStep?.step.id}
                />
              </div>
            )}

            {/* Step logs list */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Step Logs
              </p>
              <div className="space-y-1">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 px-2.5 py-1.5"
                  >
                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono text-[10px] flex-shrink-0">
                      {step.stepOrder}
                    </span>
                    <StepStatusIcon status={step.status} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{step.stepName}</span>
                      <span className="ml-2 text-gray-400 dark:text-gray-500 text-[11px] font-mono">
                        {getServiceLabel(step.stepType)}
                      </span>
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

// ── Insights page ──────────────────────────────────────────────────────────────

const STATUS_OPTIONS: Transaction['status'][] = [
  'RECEIVED',
  'VALIDATING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]

export function Insights() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stepsCache, setStepsCache] = useState<Record<string, StepLog[]>>({})
  const [loadingSteps, setLoadingSteps] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [productFilter, setProductFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [correlationId, setCorrelationId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const loadIdRef = useRef(0)

  const load = useCallback(() => {
    const id = ++loadIdRef.current
    setLoading(true)
    setError(null)
    transactionsApi
      .list({
        productLineCode: productFilter || undefined,
        status: statusFilter || undefined,
        policyNumber: policyNumber || undefined,
        accountNumber: accountNumber || undefined,
        instanceId: instanceId || undefined,
        correlationId: correlationId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      })
      .then((data) => {
        if (id === loadIdRef.current) setTransactions(data)
      })
      .catch((err: unknown) => {
        if (id === loadIdRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load transactions.')
        }
      })
      .finally(() => {
        if (id === loadIdRef.current) setLoading(false)
      })
  }, [
    productFilter,
    statusFilter,
    policyNumber,
    accountNumber,
    instanceId,
    correlationId,
    fromDate,
    toDate,
  ])

  useEffect(() => {
    load()
  }, [load])

  const toggleExpand = async (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!stepsCache[id] && !loadingSteps.has(id)) {
      setLoadingSteps((prev) => new Set(prev).add(id))
      try {
        const steps = await transactionsApi.getSteps(id)
        setStepsCache((c) => ({ ...c, [id]: steps }))
      } catch {
        setStepsCache((c) => ({ ...c, [id]: [] }))
      } finally {
        setLoadingSteps((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    }
  }

  const completedCount = transactions.filter((t) => t.status === 'COMPLETED').length
  const failedCount = transactions.filter((t) => t.status === 'FAILED').length
  const successRate =
    transactions.length > 0 ? Math.round((completedCount / transactions.length) * 100) : 0

  const topErrors = transactions
    .filter((t) => t.errorMessage)
    .reduce<Record<string, number>>((acc, t) => {
      const msg = t.errorMessage!
      acc[msg] = (acc[msg] || 0) + 1
      return acc
    }, {})
  const topErrorsList = Object.entries(topErrors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const hasFilters =
    productFilter ||
    statusFilter ||
    policyNumber ||
    accountNumber ||
    instanceId ||
    correlationId ||
    fromDate ||
    toDate

  const clearFilters = () => {
    setProductFilter('')
    setStatusFilter('')
    setPolicyNumber('')
    setAccountNumber('')
    setInstanceId('')
    setCorrelationId('')
    setFromDate('')
    setToDate('')
  }

  return (
    <div className="px-4 py-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Insights</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Search transactions, view request/response payloads, and analyze execution flow
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

      {/* Search bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
          <Search className="w-3.5 h-3.5" />
          Search
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input
            value={policyNumber}
            onChange={(e) => setPolicyNumber(e.target.value)}
            placeholder="Policy Number"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="Account Number"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
          <input
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Instance ID"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
          <input
            value={correlationId}
            onChange={(e) => setCorrelationId(e.target.value)}
            placeholder="Correlation ID"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 font-mono text-xs"
          />
          <input
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            placeholder="Product Line"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From date"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To date"
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
          />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={load}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{transactions.length} transactions</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Success rate: <span className="font-semibold text-green-700 dark:text-green-300">{successRate}%</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Completed: <span className="font-semibold text-green-600 dark:text-green-400">{completedCount}</span>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Failed: <span className="font-semibold text-red-600 dark:text-red-400">{failedCount}</span>
        </div>
      </div>

      {/* Top errors */}
      {topErrorsList.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
            Top Errors
          </p>
          <div className="flex flex-wrap gap-1.5">
            {topErrorsList.map(([msg, count]) => (
              <span
                key={msg}
                className="inline-flex items-center px-2 py-1 rounded text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800"
              >
                {msg.length > 60 ? `${msg.slice(0, 60)}…` : msg}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && transactions.length === 0 && !error && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center">
          <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {hasFilters ? 'No transactions match the current filters' : 'No transactions yet'}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto leading-relaxed">
            {!hasFilters &&
              'Transactions appear here after executing rating requests through the orchestrator.'}
          </p>
        </div>
      )}

      {/* Table — table-fixed so expanded Step Trace row doesn't grow table; flow scrolls inside cell */}
      {!loading && transactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="w-7 px-2 py-2" />
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Correlation ID
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Product
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Scope
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Premium
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Steps
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Duration · Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <React.Fragment key={tx.id}>
                  <tr
                    onClick={() => toggleExpand(tx.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <td className="px-2 py-2 text-gray-400 dark:text-gray-500">
                      {expanded.has(tx.id) ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[130px]">
                      <span title={tx.correlationId} className="truncate block">
                        {tx.correlationId.length > 18
                          ? `${tx.correlationId.slice(0, 8)}…${tx.correlationId.slice(-4)}`
                          : tx.correlationId}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {tx.productLineCode}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                          statusColor(tx.status),
                        )}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {tx.scope ? (
                        <span className="space-x-1">
                          {tx.scope.state && (
                            <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {tx.scope.state}
                            </span>
                          )}
                          {tx.scope.coverage && (
                            <span className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded text-[10px] font-medium">
                              {tx.scope.coverage}
                            </span>
                          )}
                          {tx.scope.transactionType && (
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded text-[10px]">
                              {tx.scope.transactionType}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {tx.premiumResult != null ? (
                        <span className="font-semibold text-green-700 dark:text-green-300">
                          ${Number(tx.premiumResult).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {tx.completedSteps}/{tx.stepCount}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
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
                  {expanded.has(tx.id) && (
                    <InsightDetailRow
                      tx={tx}
                      steps={stepsCache[tx.id] || []}
                      loading={loadingSteps.has(tx.id)}
                    />
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Insights
