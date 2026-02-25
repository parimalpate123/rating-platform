import React, { useState, useEffect, useMemo } from 'react'
import {
  Loader2, ChevronRight, ChevronDown, Plus, Pencil, Trash2, X, Check, Map,
  Sparkles, Upload, FileText, Link, ArrowRight, Info, Filter, Maximize2, Minimize2,
} from 'lucide-react'
import {
  mappingsApi,
  type Mapping, type FieldMapping, type TransformationType, type FieldMappingSuggestion,
} from '../../api/mappings'
import { cn } from '../../lib/utils'

// ── Suggestion preview modal ──────────────────────────────────────────────────

function MappingPreviewModal({
  suggestions,
  mode,
  productCode,
  mappingId,
  initialName,
  initialDirection,
  onCreated,
  onClose,
  onSuccessClose,
}: {
  suggestions: FieldMappingSuggestion[]
  mode: 'create' | 'append'
  productCode?: string
  mappingId?: string
  initialName?: string
  initialDirection?: 'request' | 'response'
  onCreated: () => void
  onClose: () => void
  /** When provided, called after successful create (mode === 'create') to close the entire wizard instead of going back. */
  onSuccessClose?: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(suggestions.map((_, i) => i)),
  )
  const [filter, setFilter] = useState<'all' | 'high' | 'medium'>('all')
  const [name, setName] = useState(initialName ?? '')
  const [direction, setDirection] = useState<'request' | 'response'>(initialDirection ?? 'request')
  const [mirror, setMirror] = useState(false)
  const [saving, setSaving] = useState(false)
  const [maximized, setMaximized] = useState(false)

  const reverseDir = direction === 'request' ? 'response' : 'request'
  const reverseName = name.trim() ? `${name.trim()} (${reverseDir === 'response' ? 'Response' : 'Request'})` : ''

  const reverseTransformType = (t: string): string => {
    if (t === 'multiply') return 'divide'
    if (t === 'divide') return 'multiply'
    if (['direct', 'date', 'number_format', 'boolean', 'round'].includes(t)) return t
    return 'direct' // expression, lookup, conditional, concatenate etc. can't be auto-reversed
  }

  const filtered = useMemo(() => {
    return suggestions.filter((s) => {
      const pct = s.confidence > 1 ? s.confidence : s.confidence * 100
      if (filter === 'high') return pct >= 80
      if (filter === 'medium') return pct >= 60 && pct < 80
      return true
    })
  }, [suggestions, filter])

  const toggle = (i: number) => {
    const next = new Set(selected)
    next.has(i) ? next.delete(i) : next.add(i)
    setSelected(next)
  }

  const toggleAll = () => {
    setSelected(selected.size === suggestions.length ? new Set() : new Set(suggestions.map((_, i) => i)))
  }

  const selectHighConf = () => {
    setSelected(new Set(suggestions.map((s, i) => {
      const pct = s.confidence > 1 ? s.confidence : s.confidence * 100
      return pct >= 80 ? i : -1
    }).filter((i) => i >= 0)))
  }

  const confPct = (s: FieldMappingSuggestion) =>
    Math.round(s.confidence > 1 ? s.confidence : s.confidence * 100)

  const confBadge = (pct: number) => {
    if (pct >= 90) return 'bg-green-100 text-green-800 border-green-200'
    if (pct >= 80) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (pct >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600'
  }

  const highCount = suggestions.filter((s) => confPct(s) >= 80).length
  const avgConf = suggestions.length
    ? Math.round(suggestions.reduce((sum, s) => sum + confPct(s), 0) / suggestions.length)
    : 0

  const handleAccept = async () => {
    const accepted = suggestions.filter((_, i) => selected.has(i))
    if (accepted.length === 0) return
    setSaving(true)
    try {
      if (mode === 'create') {
        if (!name.trim()) return
        const buildTransformConfig = (s: typeof accepted[0]) => {
          const cfg: Record<string, unknown> = {};
          if (s.dataType) cfg.dataType = s.dataType;
          if (s.fieldDirection) cfg.fieldDirection = s.fieldDirection;
          if (s.format) cfg.format = s.format;
          if (s.fieldIdentifier ?? s.targetPath) cfg.fieldIdentifier = s.fieldIdentifier ?? s.targetPath;
          return Object.keys(cfg).length ? cfg : undefined;
        }
        const fields = accepted.map((s) => ({
          sourcePath: s.sourcePath,
          targetPath: s.targetPath,
          transformationType: s.transformationType,
          description: s.reasoning,
          transformConfig: buildTransformConfig(s),
          defaultValue: s.defaultValue,
        }))
        await mappingsApi.createWithFields({
          name: name.trim(),
          productLineCode: productCode!,
          direction,
          status: 'draft',
          fields,
        })
        // Create mirrored reverse mapping if requested
        if (mirror && reverseName) {
          await mappingsApi.createWithFields({
            name: reverseName,
            productLineCode: productCode!,
            direction: reverseDir,
            status: 'draft',
            fields: fields.map((f) => ({
              sourcePath: f.targetPath,   // swapped
              targetPath: f.sourcePath,   // swapped
              transformationType: reverseTransformType(f.transformationType ?? 'direct'),
              description: f.description ? `[Mirrored] ${f.description}` : undefined,
              transformConfig: f.transformConfig,
              defaultValue: f.defaultValue,
            })),
          })
        }
      } else {
        for (const s of accepted) {
          const transformConfig: Record<string, unknown> = {};
          if (s.dataType) transformConfig.dataType = s.dataType;
          if (s.fieldDirection) transformConfig.fieldDirection = s.fieldDirection;
          if (s.format) transformConfig.format = s.format;
          if (s.fieldIdentifier ?? s.targetPath) transformConfig.fieldIdentifier = s.fieldIdentifier ?? s.targetPath;
          await mappingsApi.createField(mappingId!, {
            sourcePath: s.sourcePath,
            targetPath: s.targetPath,
            transformationType: s.transformationType as TransformationType,
            description: s.reasoning,
            ...(Object.keys(transformConfig).length ? { transformConfig } : {}),
            ...(s.defaultValue !== undefined ? { defaultValue: s.defaultValue } : {}),
          })
        }
      }
      onCreated()
      if (mode === 'create' && onSuccessClose) {
        onSuccessClose()
      } else {
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('fixed inset-0 bg-black/50 z-50 flex items-center justify-center', maximized ? 'p-0' : 'p-4')}>
      <div className={cn(
        'bg-white dark:bg-gray-800 shadow-2xl flex flex-col',
        maximized ? 'w-full h-full rounded-none' : 'rounded-xl w-full max-w-4xl max-h-[90vh]',
      )}>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {mode === 'create' ? 'Review AI-Generated Field Mappings' : 'AI Field Suggestions'}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {suggestions.length} suggestions &bull; {selected.size} selected &bull; avg confidence {avgConf}%
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMaximized((m) => !m)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
                title={maximized ? 'Restore' : 'Maximize'}
              >
                {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats + filter */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span><span className="font-medium text-green-600">{highCount}</span> <span className="text-gray-500 dark:text-gray-400">high conf (&ge;80%)</span></span>
              <span><span className="font-medium text-yellow-600">{suggestions.filter((s) => { const p = confPct(s); return p >= 60 && p < 80 }).length}</span> <span className="text-gray-500 dark:text-gray-400">medium (60-79%)</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All suggestions</option>
                <option value="high">High confidence only</option>
                <option value="medium">Medium confidence only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-6 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <button onClick={toggleAll} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            {selected.size === suggestions.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button onClick={selectHighConf} className="text-xs text-green-600 hover:text-green-700 font-medium">
            Select High Confidence
          </button>
        </div>

        {/* Suggestion cards */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-gray-400 dark:text-gray-500">No suggestions match the filter.</div>
          )}
          {filtered.map((s, vi) => {
            const realIdx = suggestions.indexOf(s)
            const isSelected = selected.has(realIdx)
            const pct = confPct(s)
            return (
              <div
                key={vi}
                onClick={() => toggle(realIdx)}
                className={cn(
                  'border rounded-lg p-3.5 cursor-pointer transition-colors',
                  isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(realIdx)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 h-4 w-4 text-blue-600 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-800 truncate">{s.sourcePath}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-mono text-gray-800 truncate">{s.targetPath}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium flex-shrink-0">{s.transformationType}</span>
                    </div>
                    {s.reasoning && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5 text-blue-400" />
                        <span>{s.reasoning}</span>
                      </div>
                    )}
                  </div>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0', confBadge(pct))}>
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
          {mode === 'create' && (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mapping name..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(['request', 'response'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                        direction === d
                          ? d === 'request' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-green-50 border-green-300 text-green-700'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                      )}
                    >
                      {d === 'request' ? '→ Request' : '← Response'}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mirror toggle */}
              <label className="flex items-start gap-2 cursor-pointer mb-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Also create reverse {reverseDir} mapping
                  </span>
                  {mirror && reverseName && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Will create <span className="font-medium text-gray-700 dark:text-gray-300">"{reverseName}"</span> with {selected.size} field{selected.size !== 1 ? 's' : ''} swapped
                      {' '}(source ↔ target). Complex transforms (lookup, expression) default to <span className="font-mono">direct</span>.
                    </p>
                  )}
                </div>
              </label>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">{selected.size} of {suggestions.length} selected</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button
                onClick={handleAccept}
                disabled={saving || selected.size === 0 || (mode === 'create' && !name.trim())}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {saving
                  ? 'Saving...'
                  : mode === 'create'
                    ? mirror ? `Create ${selected.size} × 2 (+ mirror)` : `Create Mapping (${selected.size})`
                    : `Add ${selected.size} Fields`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New Mapping Wizard ─────────────────────────────────────────────────────────

type WizardMethod = 'manual' | 'ai' | 'csv' | 'jira'

function NewMappingWizard({
  productCode,
  productSourceSystem,
  productTargetSystem,
  onCreated,
  onClose,
  onError,
}: {
  productCode: string
  productSourceSystem?: string
  productTargetSystem?: string
  onCreated: () => void
  onClose: () => void
  onError?: (message: string) => void
}) {
  const [method, setMethod] = useState<WizardMethod>('manual')
  const [name, setName] = useState('')
  const [direction, setDirection] = useState<'request' | 'response'>('request')
  const [mirror, setMirror] = useState(false)
  const [sourceSystem, setSourceSystem] = useState(productSourceSystem ?? '')
  const [targetSystem, setTargetSystem] = useState(productTargetSystem ?? '')
  const [requirementsText, setRequirementsText] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<FieldMappingSuggestion[] | null>(null)
  const [autoName, setAutoName] = useState('')   // AI/CSV auto-generated name
  const [maximized, setMaximized] = useState(false)

  const reverseDir = direction === 'request' ? 'response' : 'request'
  const reverseName = name.trim() ? `${name.trim()} (${reverseDir === 'response' ? 'Response' : 'Request'})` : ''

  const fromProduct = (val: string) => val === productSourceSystem || val === productTargetSystem

  // Derive a mapping name from requirements text (client-side heuristic)
  const deriveNameFromText = (text: string, src: string, tgt: string): string => {
    // First non-empty line, stripped of leading bullets/markers
    const firstLine = text.split('\n').map((l) => l.trim().replace(/^[-*•#>]+\s*/, '')).find((l) => l.length > 3) ?? ''
    const topic = firstLine.length > 0 && firstLine.length < 60 ? firstLine : ''
    const sys = [src, tgt].filter(Boolean).join(' → ')
    if (sys && topic) return `${sys} — ${topic}`
    if (sys) return `${sys} Mapping`
    if (topic) return topic
    return 'New Mapping'
  }

  const METHODS: { id: WizardMethod; icon: React.ReactNode; label: string; desc: string; disabled?: boolean }[] = [
    {
      id: 'manual',
      icon: <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
      label: 'Manual',
      desc: 'Start empty and add fields by hand',
    },
    {
      id: 'ai',
      icon: <Sparkles className="w-5 h-5 text-purple-600" />,
      label: 'AI / Text',
      desc: 'Describe requirements in plain text — AI generates field mappings',
    },
    {
      id: 'csv',
      icon: <Upload className="w-5 h-5 text-blue-600" />,
      label: 'CSV Upload',
      desc: 'Upload a CSV/TSV file with source → target columns',
    },
    {
      id: 'jira',
      icon: <Link className="w-5 h-5 text-gray-400 dark:text-gray-500" />,
      label: 'JIRA Story',
      desc: 'Import requirements from a JIRA URL',
      disabled: true,
    },
  ]

  const handleManualCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a mapping name.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await mappingsApi.create({ name: name.trim(), productLineCode: productCode, direction, status: 'draft' })
      if (mirror && reverseName) {
        await mappingsApi.create({ name: reverseName, productLineCode: productCode, direction: reverseDir, status: 'draft' })
      }
      onClose()
      onCreated()
    } catch (_e) {
      onClose()
      onError?.('Failed to create mapping. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setError(null)
    if (method === 'ai') {
      if (!requirementsText.trim()) { setError('Please enter requirements text.'); return }
      setLoading(true)
      try {
        const result = await mappingsApi.parseText({
          text: requirementsText,
          context: { sourceSystem: sourceSystem || undefined, targetSystem: targetSystem || undefined },
        })
        setSuggestions(result.suggestions)
        setAutoName(deriveNameFromText(requirementsText, sourceSystem, targetSystem))
      } catch (_e) {
        setError('Failed to parse requirements. Please try again.')
      } finally {
        setLoading(false)
      }
    } else if (method === 'csv') {
      if (!csvFile) { setError('Please select a CSV file.'); return }
      setLoading(true)
      try {
        const result = await mappingsApi.parseExcel(csvFile)
        setSuggestions(result.suggestions)
        // For CSV use the filename as the default name
        const baseName = csvFile.name.replace(/\.\w+$/, '').replace(/[-_]/g, ' ')
        const sys = [sourceSystem, targetSystem].filter(Boolean).join(' → ')
        setAutoName(sys ? `${sys} — ${baseName}` : baseName)
      } catch (_e) {
        setError('Failed to parse file. Please check the format and try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  // If suggestions are ready, hand off to preview modal
  if (suggestions !== null) {
    return (
      <MappingPreviewModal
        suggestions={suggestions}
        mode="create"
        productCode={productCode}
        initialName={autoName}
        initialDirection={direction}
        onCreated={onCreated}
        onClose={() => setSuggestions(null)}
        onSuccessClose={onClose}
      />
    )
  }

  return (
    <div className={cn('fixed inset-0 bg-black/40 z-50 flex items-center justify-center', maximized ? 'p-0' : 'p-4')}>
      <div className={cn(
        'bg-white dark:bg-gray-800 shadow-2xl flex flex-col',
        maximized ? 'w-full h-full rounded-none' : 'rounded-xl w-full max-w-2xl max-h-[90vh]',
      )}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">New Mapping</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMaximized((m) => !m)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500"
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Method selection */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Creation Method</label>
            <div className="grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  disabled={m.disabled}
                  onClick={() => !m.disabled && setMethod(m.id)}
                  className={cn(
                    'p-3 border-2 rounded-lg text-left transition-all',
                    m.disabled ? 'opacity-50 cursor-not-allowed border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800' :
                      method === m.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-600',
                  )}
                >
                  <div className="mb-1.5">{m.icon}</div>
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    {m.label}
                    {m.disabled && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded">Under development</span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Mapping name (all modes) */}
          {method !== 'csv' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Mapping Name</label>
              <input
                autoFocus={method === 'manual'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => method === 'manual' && e.key === 'Enter' && handleManualCreate()}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Map GW Request Fields"
              />
            </div>
          )}

          {/* Direction + Mirror (manual only — for ai/csv these are set in the preview modal) */}
          {method === 'manual' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Direction</label>
                <div className="flex gap-2">
                  {(['request', 'response'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors',
                        direction === d
                          ? d === 'request' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-green-50 border-green-300 text-green-700'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                      )}
                    >
                      {d === 'request' ? '→ Request' : '← Response'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer p-2.5 rounded-lg border border-dashed border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <input
                  type="checkbox"
                  checked={mirror}
                  onChange={(e) => setMirror(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <div>
                  <span className="text-xs font-medium text-gray-700">
                    Also create reverse {reverseDir} mapping
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {mirror && reverseName
                      ? <>Will also create <span className="font-medium text-gray-700">"{reverseName}"</span> — fields can be added after, or generate with AI/CSV</>
                      : 'Useful when the same fields need to be mapped in both directions'}
                  </p>
                </div>
              </label>
            </>
          )}

          {/* AI / Text method */}
          {method === 'ai' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Source System
                    {fromProduct(sourceSystem) && sourceSystem && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">from product</span>
                    )}
                  </label>
                  <input
                    value={sourceSystem}
                    onChange={(e) => setSourceSystem(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Guidewire"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Target System
                    {fromProduct(targetSystem) && targetSystem && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded">from product</span>
                    )}
                  </label>
                  <input
                    value={targetSystem}
                    onChange={(e) => setTargetSystem(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Rating Engine"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Requirements / JIRA Story Text</label>
                <textarea
                  value={requirementsText}
                  onChange={(e) => setRequirementsText(e.target.value)}
                  rows={maximized ? 20 : 8}
                  className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={'Paste JIRA story or plain-text requirements here...\n\nExamples:\n  map quoteNumber to policy.id\n  insured.state → address.state\n  Map classification.code to ratingFactors.businessType using lookup'}
                />
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-purple-800">
                  AI will parse your text and extract field mappings. Mention transformations explicitly (e.g., "using lookup", "date format MM/DD/YYYY", "concatenate first and last name").
                </p>
              </div>
            </div>
          )}

          {/* CSV Upload method */}
          {method === 'csv' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Upload CSV / TSV File</label>
                <label className={cn(
                  'flex flex-col items-center justify-center w-full border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                  maximized ? 'h-64' : 'h-32',
                  csvFile ? 'border-green-400 bg-green-50' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}>
                  <Upload className={cn('w-6 h-6 mb-2', csvFile ? 'text-green-600' : 'text-gray-400 dark:text-gray-500')} />
                  {csvFile ? (
                    <span className="text-sm font-medium text-green-700">{csvFile.name}</span>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Click to upload or drag & drop</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">CSV, TSV files accepted</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-800 mb-1">Expected format:</p>
                <p className="text-xs text-blue-700 font-mono">source_path, target_path, transform_type, description</p>
                <p className="text-xs text-blue-600 mt-1">First row may be a header (auto-detected). Columns 1 &amp; 2 are required.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-xl flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>

          {method === 'manual' ? (
            <button
              onClick={handleManualCreate}
              disabled={loading || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Mapping'}
            </button>
          ) : method !== 'jira' ? (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Generate Suggestions</>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ── Constants ────────────────────────────────────────────────────────────────

const TRANSFORM_TYPES: { value: TransformationType; label: string }[] = [
  { value: 'direct', label: 'Direct' },
  { value: 'constant', label: 'Constant' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'divide', label: 'Divide' },
  { value: 'round', label: 'Round' },
  { value: 'per_unit', label: 'Per Unit' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'expression', label: 'Expression' },
  { value: 'concatenate', label: 'Concatenate' },
  { value: 'date', label: 'Date Format' },
  { value: 'number_format', label: 'Number Format' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'default', label: 'Default' },
  { value: 'split', label: 'Split' },
  { value: 'aggregate', label: 'Aggregate' },
  { value: 'custom', label: 'Custom' },
]

const TYPES_WITH_CONFIG = ['multiply', 'divide', 'round', 'per_unit', 'lookup', 'date', 'expression']

const TYPE_COLORS: Record<string, string> = {
  direct: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  multiply: 'bg-orange-100 text-orange-700',
  divide: 'bg-orange-100 text-orange-700',
  round: 'bg-yellow-100 text-yellow-700',
  per_unit: 'bg-blue-100 text-blue-700',
  lookup: 'bg-purple-100 text-purple-700',
  expression: 'bg-indigo-100 text-indigo-700',
  date: 'bg-teal-100 text-teal-700',
  concatenate: 'bg-pink-100 text-pink-700',
  constant: 'bg-green-100 text-green-700',
}

// ── Config sub-form ──────────────────────────────────────────────────────────

function TransformConfigFields({
  type,
  config,
  onChange,
}: {
  type: TransformationType
  config: Record<string, unknown>
  onChange: (c: Record<string, unknown>) => void
}) {
  const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800'

  switch (type) {
    case 'multiply':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12 flex-shrink-0">Factor:</span>
          <input type="number" step="any" value={String(config.factor ?? '')} onChange={(e) => onChange({ ...config, factor: e.target.value })} className={inputCls} placeholder="1.5" />
        </div>
      )
    case 'divide':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12 flex-shrink-0">Divisor:</span>
          <input type="number" step="any" value={String(config.divisor ?? '')} onChange={(e) => onChange({ ...config, divisor: e.target.value })} className={inputCls} placeholder="100" />
        </div>
      )
    case 'round':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 flex-shrink-0">Decimals:</span>
          <input type="number" min={0} max={10} value={String(config.decimals ?? '')} onChange={(e) => onChange({ ...config, decimals: e.target.value })} className={inputCls} placeholder="2" />
        </div>
      )
    case 'per_unit':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 flex-shrink-0">Unit size:</span>
          <input type="number" step="any" value={String(config.unitSize ?? '')} onChange={(e) => onChange({ ...config, unitSize: e.target.value })} className={inputCls} placeholder="1000" />
        </div>
      )
    case 'lookup':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 flex-shrink-0">Table key:</span>
          <input type="text" value={String(config.tableKey ?? '')} onChange={(e) => onChange({ ...config, tableKey: e.target.value })} className={inputCls} placeholder="state_factor" />
        </div>
      )
    case 'date':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-12 flex-shrink-0">Format:</span>
          <select value={String(config.format ?? '')} onChange={(e) => onChange({ ...config, format: e.target.value })} className={inputCls}>
            <option value="">Select...</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="timestamp">Timestamp</option>
            <option value="epoch">Epoch (ms)</option>
          </select>
        </div>
      )
    case 'expression':
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-16 flex-shrink-0">Expr:</span>
          <input type="text" value={String(config.expression ?? '')} onChange={(e) => onChange({ ...config, expression: e.target.value })} className={inputCls} placeholder="value * 0.01" />
        </div>
      )
    default:
      return null
  }
}

// ── Field details sub-form (shared between AddFieldRow and FieldRow edit) ─────

const DATA_TYPES = [
  { value: '', label: 'Any' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
]

const FIELD_DIRECTIONS = [
  { value: 'both', label: 'Both (Input & Output)' },
  { value: 'input', label: 'Input Only' },
  { value: 'output', label: 'Output Only' },
]

const inputCls = 'w-full px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800'

/** Strip one level of surrounding double or single quotes so text fields don't display with quotes. */
function stripSurroundingQuotes(s: string): string {
  if (typeof s !== 'string') return ''
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

/** Parse description line for legacy data that has no transformConfig/defaultValue in DB (e.g. AWS). */
function parseDescriptionForDetails(description: string): { fieldDirection?: string; dataType?: string; defaultValue?: string; fieldIdentifier?: string } {
  const out: { fieldDirection?: string; dataType?: string; defaultValue?: string; fieldIdentifier?: string } = {}
  if (!description?.trim()) return out
  const line = description.trim()
  // Split by | or / so we get [ "source → target", "direction", "typePart" ] or similar
  const parts = line.split(/\s*[\|/]\s*/).map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const dirRaw = (parts.length >= 2 ? parts[1] : '').toLowerCase()
    if (dirRaw === 'input') out.fieldDirection = 'input'
    else if (dirRaw === 'output') out.fieldDirection = 'output'
    else if (dirRaw === 'both') out.fieldDirection = 'both'
  }
  if (parts.length >= 3) {
    const typePart = parts[2]
    const quotedDefault = typePart.match(/,?\s*default:\s*["']([^"']*)["']\s*$/i)
    const unquotedDefault = typePart.match(/,?\s*default:\s*(\S+)\s*$/i)
    if (quotedDefault) out.defaultValue = quotedDefault[1]
    else if (unquotedDefault) out.defaultValue = unquotedDefault[1]
    const beforeDefault = typePart.replace(/,?\s*default:\s*.*$/i, '').trim()
    const typeMatch = beforeDefault.match(/\b(string|number|integer|date|boolean|any)\b/i)
    if (typeMatch) out.dataType = typeMatch[1].toLowerCase()
  }
  const arrowMatch = line.match(/(?:→|->)\s*([^\s|/]+)/)
  if (arrowMatch) out.fieldIdentifier = arrowMatch[1].trim()
  return out
}

interface FieldDetailState {
  defaultValue: string
  description: string
  dataType: string
  fieldDirection: string
  fieldIdentifier: string
  skipMapping: boolean
  skipBehavior: string
  sampleInput: string
  sampleOutput: string
}

function extractDetails(transformConfig: Record<string, unknown>, defaultValue?: string, description?: string): FieldDetailState {
  const rawDefault = stripSurroundingQuotes(defaultValue ?? '')
  const fromConfig = {
    defaultValue: rawDefault,
    description: description ?? '',
    dataType: String(transformConfig?.dataType ?? ''),
    fieldDirection: String(transformConfig?.fieldDirection ?? 'both'),
    fieldIdentifier: stripSurroundingQuotes(String(transformConfig?.fieldIdentifier ?? '')),
    skipMapping: Boolean(transformConfig?.skipMapping),
    skipBehavior: String(transformConfig?.skipBehavior ?? 'exclude'),
    sampleInput: stripSurroundingQuotes(String(transformConfig?.sampleInput ?? '')),
    sampleOutput: stripSurroundingQuotes(String(transformConfig?.sampleOutput ?? '')),
  }
  const hasStoredDetails = fromConfig.dataType || fromConfig.fieldDirection !== 'both' || (defaultValue != null && defaultValue !== '')
  if (hasStoredDetails) return fromConfig
  const parsed = parseDescriptionForDetails(description ?? '')
  const parsedDefault = parsed.defaultValue != null ? stripSurroundingQuotes(parsed.defaultValue) : ''
  const parsedIdentifier = parsed.fieldIdentifier != null ? stripSurroundingQuotes(parsed.fieldIdentifier) : ''
  return {
    ...fromConfig,
    defaultValue: (fromConfig.defaultValue || parsedDefault) || '',
    dataType: (fromConfig.dataType || parsed.dataType) ?? '',
    fieldDirection: fromConfig.fieldDirection !== 'both' ? fromConfig.fieldDirection : (parsed.fieldDirection ?? 'both'),
    fieldIdentifier: (fromConfig.fieldIdentifier || parsedIdentifier) || '',
  }
}

function mergeDetailsIntoConfig(config: Record<string, unknown>, details: FieldDetailState): Record<string, unknown> {
  return {
    ...config,
    ...(details.dataType ? { dataType: details.dataType } : {}),
    ...(details.fieldDirection && details.fieldDirection !== 'both' ? { fieldDirection: details.fieldDirection } : { fieldDirection: undefined }),
    ...(details.fieldIdentifier ? { fieldIdentifier: details.fieldIdentifier } : {}),
    skipMapping: details.skipMapping,
    ...(details.skipMapping ? { skipBehavior: details.skipBehavior } : {}),
    ...(details.sampleInput ? { sampleInput: details.sampleInput } : {}),
    ...(details.sampleOutput ? { sampleOutput: details.sampleOutput } : {}),
  }
}

function FieldDetailsSection({
  details,
  onChange,
  defaultOpen = false,
}: {
  details: FieldDetailState
  onChange: (d: FieldDetailState) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const set = (key: keyof FieldDetailState, val: unknown) => onChange({ ...details, [key]: val })

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Field Details
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Description</label>
            <input type="text" value={details.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional notes about this field..." className={inputCls} />
          </div>

          {/* Default Value + Field Identifier */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Default Value</label>
              <input type="text" value={details.defaultValue} onChange={(e) => set('defaultValue', e.target.value)} placeholder="e.g. 0 or N/A" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Field Identifier</label>
              <input type="text" value={details.fieldIdentifier} onChange={(e) => set('fieldIdentifier', e.target.value)} placeholder="e.g. policy.state" className={inputCls} />
            </div>
          </div>

          {/* Data Type + Field Direction */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Data Type</label>
              <select value={details.dataType} onChange={(e) => set('dataType', e.target.value)} className={inputCls}>
                {DATA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Field Direction</label>
              <select value={details.fieldDirection} onChange={(e) => set('fieldDirection', e.target.value)} className={inputCls}>
                {FIELD_DIRECTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* Skip Mapping */}
          <div className="flex items-center gap-3 py-0.5">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={details.skipMapping}
                onChange={(e) => set('skipMapping', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 h-3.5 w-3.5"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Skip Mapping</span>
            </label>
            {details.skipMapping && (
              <select value={details.skipBehavior} onChange={(e) => set('skipBehavior', e.target.value)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800">
                <option value="exclude">Exclude field</option>
                <option value="use_default">Use default value</option>
              </select>
            )}
          </div>

          {/* Sample Input / Output */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Sample Input</label>
              <input type="text" value={details.sampleInput} onChange={(e) => set('sampleInput', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">Sample Output</label>
              <input type="text" value={details.sampleOutput} onChange={(e) => set('sampleOutput', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── New field row ────────────────────────────────────────────────────────────

function AddFieldRow({ mappingId, onAdded }: { mappingId: string; onAdded: () => void }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({
    sourcePath: '', targetPath: '',
    transformationType: 'direct' as TransformationType,
    isRequired: false,
    transformConfig: {} as Record<string, unknown>,
  })
  const [details, setDetails] = useState<FieldDetailState>(extractDetails({}))
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!form.sourcePath || !form.targetPath) return
    setSaving(true)
    try {
      await mappingsApi.createField(mappingId, {
        sourcePath: form.sourcePath,
        targetPath: form.targetPath,
        transformationType: form.transformationType,
        transformConfig: mergeDetailsIntoConfig(form.transformConfig, details),
        isRequired: form.isRequired,
        defaultValue: details.defaultValue || undefined,
        description: details.description || undefined,
      })
      setForm({ sourcePath: '', targetPath: '', transformationType: 'direct', isRequired: false, transformConfig: {} })
      setDetails(extractDetails({}))
      setShow(false)
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  if (!show) {
    return (
      <button onClick={() => setShow(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
        <Plus className="w-3 h-3" /> Add Field
      </button>
    )
  }

  return (
    <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-[1fr_1fr_120px_60px] gap-2 items-center">
        <input type="text" value={form.sourcePath} onChange={(e) => setForm((f) => ({ ...f, sourcePath: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800" placeholder="Source path (e.g. policy.state)" />
        <input type="text" value={form.targetPath} onChange={(e) => setForm((f) => ({ ...f, targetPath: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800" placeholder="Target path (e.g. State)" />
        <select value={form.transformationType} onChange={(e) => setForm((f) => ({ ...f, transformationType: e.target.value as TransformationType, transformConfig: {} }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800">
          {TRANSFORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} className="rounded border-gray-300 dark:border-gray-600" />
          Req
        </label>
      </div>
      {TYPES_WITH_CONFIG.includes(form.transformationType) && (
        <div className="pl-0">
          <TransformConfigFields type={form.transformationType} config={form.transformConfig} onChange={(c) => setForm((f) => ({ ...f, transformConfig: c }))} />
        </div>
      )}
      <FieldDetailsSection details={details} onChange={setDetails} />
      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleAdd} disabled={saving || !form.sourcePath || !form.targetPath} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Check className="w-3 h-3" /> {saving ? 'Adding...' : 'Add'}
        </button>
        <button onClick={() => setShow(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">Cancel</button>
      </div>
    </div>
  )
}

// ── Field table row ──────────────────────────────────────────────────────────

function FieldRow({ field, mappingId, onChanged }: { field: FieldMapping; mappingId: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(field)
  const [details, setDetails] = useState<FieldDetailState>(
    extractDetails(field.transformConfig, field.defaultValue, field.description),
  )
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setForm(field)
    setDetails(extractDetails(field.transformConfig, field.defaultValue, field.description))
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await mappingsApi.updateField(mappingId, field.id, {
        sourcePath: form.sourcePath,
        targetPath: form.targetPath,
        transformationType: form.transformationType,
        transformConfig: mergeDetailsIntoConfig(form.transformConfig, details),
        isRequired: form.isRequired,
        defaultValue: details.defaultValue || undefined,
        description: details.description || undefined,
      })
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    await mappingsApi.deleteField(mappingId, field.id)
    onChanged()
  }

  const typeColor = TYPE_COLORS[field.transformationType] ?? 'bg-gray-100 text-gray-600'
  const dirValue = String(field.transformConfig?.fieldDirection ?? '')
  const isSkipped = Boolean(field.transformConfig?.skipMapping)

  // Whether the field has extended details set
  const hasDetails = Boolean(
    field.description || field.defaultValue ||
    dirValue || field.transformConfig?.dataType ||
    field.transformConfig?.fieldIdentifier || isSkipped ||
    field.transformConfig?.sampleInput || field.transformConfig?.sampleOutput
  )

  if (editing) {
    return (
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-[1fr_1fr_120px_60px] gap-2 items-center">
          <input type="text" value={form.sourcePath} onChange={(e) => setForm((f) => ({ ...f, sourcePath: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800" />
          <input type="text" value={form.targetPath} onChange={(e) => setForm((f) => ({ ...f, targetPath: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800" />
          <select value={form.transformationType} onChange={(e) => setForm((f) => ({ ...f, transformationType: e.target.value as TransformationType, transformConfig: {} }))} className="px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-800">
            {TRANSFORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm((f) => ({ ...f, isRequired: e.target.checked }))} className="rounded border-gray-300" />
            Req
          </label>
        </div>
        {TYPES_WITH_CONFIG.includes(form.transformationType) && (
          <TransformConfigFields type={form.transformationType} config={form.transformConfig} onChange={(c) => setForm((f) => ({ ...f, transformConfig: c }))} />
        )}
        <FieldDetailsSection details={details} onChange={setDetails} defaultOpen={hasDetails} />
        <div className="flex items-center gap-2 pt-1">
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"><Check className="w-3 h-3" /> Save</button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg group', isSkipped ? 'opacity-60' : '')}>
      <div className="grid grid-cols-[1fr_1fr_100px_36px_auto] gap-2 items-center py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">
        <span className={cn('text-xs font-mono text-gray-700 dark:text-gray-300 truncate', isSkipped && 'line-through text-gray-400 dark:text-gray-500')}>{field.sourcePath}</span>
        <span className={cn('text-xs font-mono text-gray-700 dark:text-gray-300 truncate', isSkipped && 'line-through text-gray-400 dark:text-gray-500')}>{field.targetPath}</span>
        <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-medium', isSkipped ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500' : typeColor)}>{field.transformationType}</span>
        <span className="text-center">{field.isRequired ? <Check className="w-3 h-3 text-green-600 mx-auto" /> : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}</span>
        <div className="flex items-center gap-1.5 justify-end">
          {/* Direction badge */}
          {dirValue && dirValue !== 'both' && (
            <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0',
              dirValue === 'input' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
            )}>
              {dirValue === 'input' ? 'IN' : 'OUT'}
            </span>
          )}
          {/* Skip badge */}
          {isSkipped && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 flex-shrink-0">SKIP</span>
          )}
          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={startEditing} className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"><Pencil className="w-3 h-3" /></button>
            <button onClick={handleDelete} className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        </div>
      </div>
      {/* Description subtitle */}
      {field.description && (
        <div className="px-3 -mt-1 pb-1">
          <span className="text-[10px] italic text-gray-400 dark:text-gray-500">{field.description}</span>
        </div>
      )}
    </div>
  )
}

// ── Mapping accordion item ───────────────────────────────────────────────────

function MappingAccordion({
  mapping,
  index,
  onDeleted,
  onFieldsChanged,
  onUpdated,
}: {
  mapping: Mapping
  index: number
  onDeleted: () => void
  onFieldsChanged?: () => void
  onUpdated?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [fields, setFields] = useState<FieldMapping[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestData, setSuggestData] = useState<FieldMappingSuggestion[] | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState(mapping.name)
  const [editDirection, setEditDirection] = useState<'request' | 'response'>(mapping.direction as 'request' | 'response')
  const [editSaving, setEditSaving] = useState(false)

  const loadFields = async () => {
    setLoading(true)
    try {
      const data = await mappingsApi.listFields(mapping.id)
      setFields(data)
      setLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    if (!open && !loaded) loadFields()
    setOpen(!open)
  }

  const handleSuggest = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSuggesting(true)
    try {
      const result = await mappingsApi.suggestFields(mapping.id)
      setSuggestData(result.suggestions)
    } finally {
      setSuggesting(false)
    }
  }

  const handleEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditName(mapping.name)
    setEditDirection(mapping.direction as 'request' | 'response')
    setEditMode(true)
  }

  const handleEditSave = async () => {
    if (!editName.trim()) return
    setEditSaving(true)
    try {
      await mappingsApi.update(mapping.id, { name: editName.trim(), direction: editDirection })
      setEditMode(false)
      onUpdated?.()
    } finally {
      setEditSaving(false)
    }
  }

  const handleEditCancel = () => {
    setEditMode(false)
    setEditName(mapping.name)
    setEditDirection(mapping.direction as 'request' | 'response')
  }

  const dirColor = mapping.direction === 'request' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'

  const nameTrimmed = (mapping.name ?? '').trim()
  const displayName = nameTrimmed || 'Unnamed mapping'

  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      {suggestData && (
        <MappingPreviewModal
          suggestions={suggestData}
          mode="append"
          mappingId={mapping.id}
          onCreated={() => { setSuggestData(null); loadFields(); onFieldsChanged?.() }}
          onClose={() => setSuggestData(null)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 pr-2">
          {editMode ? (
            /* Inline edit form */
            <div className="flex-1 flex items-center gap-2 px-4 py-2.5">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleEditSave(); if (e.key === 'Escape') handleEditCancel() }}
                autoFocus
                className="flex-1 px-2.5 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800"
                placeholder="Mapping name..."
              />
              <div className="flex gap-1 flex-shrink-0">
                {(['request', 'response'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setEditDirection(d)}
                    className={cn(
                      'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      editDirection === d
                        ? d === 'request' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-green-50 border-green-300 text-green-700'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
                    )}
                  >
                    {d === 'request' ? '→ Req' : '← Resp'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editName.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
              >
                <Check className="w-3 h-3" /> {editSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={handleEditCancel} className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={toggle} className="flex-1 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-w-0">
              {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
              {/* Number badge */}
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                {index}
              </span>
              {/* Mapping name (exactly as stored) */}
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate min-w-0" title={displayName}>{displayName}</span>
              {/* Direction */}
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0', dirColor)}>{mapping.direction}</span>
              {/* Field count */}
              <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 w-16 text-right">
                {loaded ? `${fields.length} field${fields.length !== 1 ? 's' : ''}` : ''}
              </span>
              {/* Date */}
              <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0 hidden md:block">
                {fmtDate(mapping.createdAt)}
              </span>
              {/* User */}
              <span
                className="flex-shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-500 dark:text-gray-400 font-medium hidden md:block"
                title={`Created by ${mapping.createdBy || 'System'}`}
              >
                {mapping.createdBy || 'System'}
              </span>
            </button>
          )}

          {/* Action buttons — hidden during edit mode (edit has its own save/cancel) */}
          {!editMode && (
            <>
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                title="AI suggest more fields"
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors flex-shrink-0"
              >
                {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                <span className="hidden sm:inline">{suggesting ? '' : 'Suggest'}</span>
              </button>
              <button
                onClick={handleEditOpen}
                title="Edit mapping name / direction"
                className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-colors flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={async () => { if (confirm(`Delete mapping "${mapping.name}"?`)) { await mappingsApi.delete(mapping.id); onDeleted() } }}
            className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors flex-shrink-0"
            title="Delete mapping"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {open && !editMode && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-1">
            {loading && (
              <div className="flex items-center gap-2 py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                <span className="text-xs text-gray-400 dark:text-gray-500">Loading fields...</span>
              </div>
            )}

            {!loading && fields.length > 0 && (
              <>
                <div className="grid grid-cols-[1fr_1fr_100px_36px_auto] gap-2 px-3 pb-1">
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Source</span>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Target</span>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase text-center">Type</span>
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase text-center">Req</span>
                  <span />
                </div>
                {fields.map((f) => (
                  <FieldRow key={f.id} field={f} mappingId={mapping.id} onChanged={loadFields} />
                ))}
              </>
            )}

            {!loading && fields.length === 0 && loaded && (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No field mappings configured yet.</p>
            )}

            <AddFieldRow mappingId={mapping.id} onAdded={loadFields} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function MappingsTab({
  productCode,
  sourceSystem = '',
  targetSystem = '',
}: {
  productCode: string
  sourceSystem?: string
  targetSystem?: string
}) {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const load = () => {
    setLoading(true)
    mappingsApi
      .list(productCode)
      .then(setMappings)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load mappings'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [productCode])

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
  }

  if (error) {
    return <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
  }

  return (
    <>
      {showWizard && (
        <NewMappingWizard
          productCode={productCode}
          productSourceSystem={sourceSystem}
          productTargetSystem={targetSystem}
          onCreated={load}
          onClose={() => { setShowWizard(false); setCreateError(null) }}
          onError={setCreateError}
        />
      )}
      {createError && (
        <div className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <span>{createError}</span>
          <button type="button" onClick={() => setCreateError(null)} className="text-red-600 dark:text-red-400 hover:underline">Dismiss</button>
        </div>
      )}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mappings.length === 0 ? 'No mappings configured yet.' : `${mappings.length} mapping${mappings.length !== 1 ? 's' : ''} configured`}
          </p>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-200 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
          >
            <Plus className="w-3 h-3" /> New Mapping
          </button>
        </div>

        {mappings.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-12 text-center">
            <Map className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No mappings yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
              Create manually, generate from plain-text requirements, or upload a CSV file.
            </p>
            <button onClick={() => setShowWizard(true)} className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              + New Mapping
            </button>
          </div>
        ) : (
          mappings.map((m, i) => (
            <MappingAccordion
              key={m.id}
              mapping={m}
              index={i + 1}
              onDeleted={load}
              onFieldsChanged={load}
              onUpdated={load}
            />
          ))
        )}
      </div>
    </>
  )
}
