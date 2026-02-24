import { useEffect, useRef } from 'react'
import { X, CheckCircle, XCircle, Circle, MinusCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getServiceLabel, getEndpointLabel, type DiagramStep, type DiagramResult } from './ExecutionFlowDiagram'

// ── Step type badge ───────────────────────────────────────────────────────────

const STEP_BADGE_STYLES: Record<string, string> = {
  run_custom_flow: 'bg-violet-100 text-violet-700',
  field_mapping: 'bg-blue-100 text-blue-700',
  apply_rules: 'bg-green-100 text-green-700',
  format_transform: 'bg-orange-100 text-orange-700',
  call_rating_engine: 'bg-purple-100 text-purple-700',
  call_external_api: 'bg-indigo-100 text-indigo-700',
  call_orchestrator: 'bg-teal-100 text-teal-700',
  publish_event: 'bg-pink-100 text-pink-700',
  enrich: 'bg-yellow-100 text-yellow-700',
}

// ── Status icon + label ───────────────────────────────────────────────────────

function StatusDisplay({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'completed')
    return (
      <span className="flex items-center gap-1 text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Completed</span>
      </span>
    )
  if (s === 'failed')
    return (
      <span className="flex items-center gap-1 text-red-600">
        <XCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Failed</span>
      </span>
    )
  if (s === 'skipped')
    return (
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <MinusCircle className="w-4 h-4" />
        <span className="text-xs font-medium">Skipped (condition not met)</span>
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-gray-400">
      <Circle className="w-4 h-4" />
      <span className="text-xs font-medium capitalize">{status.toLowerCase()}</span>
    </span>
  )
}

// ── Config key-value display ──────────────────────────────────────────────────

function ConfigKV({ config }: { config: Record<string, unknown> }) {
  const entries = Object.entries(config).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return <p className="text-xs text-gray-400 dark:text-gray-500 italic">No config values</p>
  return (
    <dl className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <dt className="text-[11px] font-medium text-gray-500 dark:text-gray-400 w-28 flex-shrink-0">{key}</dt>
          <dd className="text-[11px] text-gray-800 dark:text-gray-200 font-mono break-all">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">{label}</p>
  )
}

// ── StepDetailPanel ───────────────────────────────────────────────────────────

export interface StepDetailPanelProps {
  step: DiagramStep
  result?: DiagramResult
  onClose: () => void
  /** When set, panel uses this width and shows a resize handle (drag to expand). */
  width?: number
  /** Callback when user starts dragging the resize handle; parent should run resize logic. */
  onResizeStart?: () => void
}

export function StepDetailPanel({ step, result, onClose, width = 320, onResizeStart }: StepDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const badgeStyle = STEP_BADGE_STYLES[step.stepType] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  const serviceLabel = getServiceLabel(step.stepType, step.config)
  const endpointLabel = getEndpointLabel(step.stepType, step.config)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {onResizeStart && (
        <div
          role="button"
          tabIndex={0}
          onMouseDown={(e) => { e.preventDefault(); onResizeStart() }}
          className="relative w-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-600 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize transition-colors flex items-center justify-center group z-10"
          style={{ minWidth: 6 }}
          aria-label="Resize panel"
        >
          <div className="w-0.5 h-12 rounded-full bg-gray-400 group-hover:bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col overflow-hidden"
        style={{ width: width }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {result && <StatusDisplay status={result.status} />}
              <span
                className={cn(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                  badgeStyle,
                )}
              >
                {step.stepType.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1.5 leading-snug">{step.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Service info */}
          <div>
            <SectionLabel label="Service" />
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5 space-y-1">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{serviceLabel}</p>
              {endpointLabel && (
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{endpointLabel}</p>
              )}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                mock
              </span>
            </div>
          </div>

          {/* Execution info (only in execution mode) */}
          {result && (
            <div>
              <SectionLabel label="Execution" />
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5">
                <dl className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <dt className="text-[11px] text-gray-500 dark:text-gray-400">Status</dt>
                    <dd>
                      <StatusDisplay status={result.status} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-[11px] text-gray-500">Duration</dt>
                    <dd className="text-xs font-mono text-gray-800 dark:text-gray-200">{result.durationMs}ms</dd>
                  </div>
                  {result.startedAt && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[11px] text-gray-500 dark:text-gray-400">Started</dt>
                      <dd className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
                        {new Date(result.startedAt).toLocaleTimeString()}
                      </dd>
                    </div>
                  )}
                  {result.completedAt && (
                    <div className="flex items-center justify-between">
                      <dt className="text-[11px] text-gray-500 dark:text-gray-400">Completed</dt>
                      <dd className="text-[11px] font-mono text-gray-600 dark:text-gray-400">
                        {new Date(result.completedAt).toLocaleTimeString()}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}

          {/* Error detail */}
          {result?.error && (
            <div>
              <SectionLabel label="Error" />
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{result.error}</p>
              </div>
            </div>
          )}

          {/* Output snapshot */}
          {result?.output && (
            <div>
              <SectionLabel label="Output" />
              <pre className="text-[10px] font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-auto max-h-48 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {JSON.stringify(result.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Step config */}
          {step.config && Object.keys(step.config).length > 0 && (
            <div>
              <SectionLabel label="Step Config" />
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2.5">
                <ConfigKV config={step.config} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate">id: {step.id}</p>
        </div>
      </div>
    </div>
  )
}
