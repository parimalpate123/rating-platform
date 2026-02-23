import React from 'react'
import { CheckCircle, XCircle, Circle } from 'lucide-react'
import { cn } from '../../lib/utils'

// ── Shared types ──────────────────────────────────────────────────────────────

export interface DiagramStep {
  id: string
  name: string
  stepType: string
  stepOrder: number
  config?: Record<string, unknown>
}

export interface DiagramResult {
  stepId?: string
  stepName?: string
  stepType?: string
  status: string
  durationMs: number
  error?: string
  output?: Record<string, unknown>
  startedAt?: string
  completedAt?: string
}

// ── Service / endpoint label helpers ─────────────────────────────────────────

export function getServiceLabel(stepType: string, config?: Record<string, unknown>): string {
  switch (stepType) {
    case 'field_mapping':
    case 'format_transform':
      return 'transform-service'
    case 'apply_rules':
      return 'rules-service'
    case 'call_rating_engine':
      return config?.systemCode ? String(config.systemCode) : 'external engine'
    case 'publish_event':
      return 'kafka (mock)'
    default:
      return stepType.replace(/_/g, '-')
  }
}

export function getEndpointLabel(stepType: string, config?: Record<string, unknown>): string {
  switch (stepType) {
    case 'field_mapping':
    case 'format_transform':
      return 'POST /api/v1/transform'
    case 'apply_rules':
      return 'POST /api/v1/rules/evaluate'
    case 'call_rating_engine': {
      const code = config?.systemCode ? String(config.systemCode) : 'engine'
      return `POST mock/${code}/rate`
    }
    case 'publish_event': {
      const topic = config?.topic ? String(config.topic) : 'topic'
      return `topic: ${topic}`
    }
    default:
      return ''
  }
}

// ── Step type visual styles ───────────────────────────────────────────────────

const STEP_NODE_STYLES: Record<string, string> = {
  validate_request: 'border-l-cyan-400',
  field_mapping: 'border-l-blue-400',
  apply_rules: 'border-l-green-400',
  format_transform: 'border-l-orange-400',
  call_rating_engine: 'border-l-purple-400',
  call_external_api: 'border-l-indigo-400',
  call_orchestrator: 'border-l-teal-400',
  publish_event: 'border-l-pink-400',
  enrich: 'border-l-yellow-400',
}

const STEP_BADGE_STYLES: Record<string, string> = {
  validate_request: 'bg-cyan-100 text-cyan-700',
  field_mapping: 'bg-blue-100 text-blue-700',
  apply_rules: 'bg-green-100 text-green-700',
  format_transform: 'bg-orange-100 text-orange-700',
  call_rating_engine: 'bg-purple-100 text-purple-700',
  call_external_api: 'bg-indigo-100 text-indigo-700',
  call_orchestrator: 'bg-teal-100 text-teal-700',
  publish_event: 'bg-pink-100 text-pink-700',
  enrich: 'bg-yellow-100 text-yellow-700',
}

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'completed') return <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
  if (s === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
  return <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
}

function nodeRingClass(status?: string): string {
  if (!status) return ''
  const s = status.toLowerCase()
  if (s === 'completed') return 'ring-1 ring-green-400'
  if (s === 'failed') return 'ring-2 ring-red-400'
  return ''
}

// ── ExecutionFlowDiagram ──────────────────────────────────────────────────────

interface ExecutionFlowDiagramProps {
  steps: DiagramStep[]
  results?: DiagramResult[]
  onStepClick?: (step: DiagramStep, result?: DiagramResult) => void
  selectedStepId?: string | null
}

export function ExecutionFlowDiagram({
  steps,
  results,
  onStepClick,
  selectedStepId,
}: ExecutionFlowDiagramProps) {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder)

  const getResult = (step: DiagramStep, idx: number): DiagramResult | undefined => {
    if (!results) return undefined
    const byId = results.find((r) => r.stepId === step.id)
    if (byId) return byId
    const byName = results.find((r) => r.stepName === step.name)
    if (byName) return byName
    return results[idx]
  }

  if (sorted.length === 0) {
    return <div className="text-center py-6 text-xs text-gray-400 dark:text-gray-500">No steps to display</div>
  }

  return (
    <div
      className="execution-flow-scroll min-w-0 w-full max-w-full overflow-x-scroll overflow-y-hidden pb-1.5"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="flex items-start gap-0 min-w-max px-1 py-1">
        {sorted.map((step, idx) => {
          const result = getResult(step, idx)
          const leftBorder = STEP_NODE_STYLES[step.stepType] ?? 'border-l-gray-400'
          const badgeStyle = STEP_BADGE_STYLES[step.stepType] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          const serviceLabel = getServiceLabel(step.stepType, step.config)
          const isSelected = selectedStepId === step.id
          const ring = nodeRingClass(result?.status)

          return (
            <React.Fragment key={step.id}>
              {/* Step node */}
              <div
                onClick={() => onStepClick?.(step, result)}
                className={cn(
                  'w-32 rounded-md border border-gray-200 dark:border-gray-700 border-l-4 bg-white dark:bg-gray-800 p-2 flex-shrink-0',
                  leftBorder,
                  ring,
                  isSelected && 'ring-2 ring-blue-500',
                  onStepClick && 'cursor-pointer hover:shadow-md transition-shadow',
                )}
              >
                {/* Name */}
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-tight mb-1 line-clamp-2 min-h-[1.75rem]">
                  {step.name}
                </p>
                {/* Type badge */}
                <span
                  className={cn(
                    'inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium mb-0.5',
                    badgeStyle,
                  )}
                >
                  {step.stepType.replace(/_/g, ' ')}
                </span>
                {/* Service label */}
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">{serviceLabel}</p>
                {/* Execution overlay */}
                {result && (
                  <div className="mt-1.5 pt-1 border-t border-gray-100 dark:border-gray-700 flex items-center gap-1">
                    <StatusIcon status={result.status} />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto font-mono">
                      {result.durationMs}ms
                    </span>
                  </div>
                )}
              </div>

              {/* Arrow connector */}
              {idx < sorted.length - 1 && (
                <div className="flex items-center self-center flex-shrink-0">
                  <div className="w-3 h-px bg-gray-300 dark:bg-gray-600" />
                  <span className="text-gray-400 dark:text-gray-500 text-[11px] -ml-0.5">▶</span>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
