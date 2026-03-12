import { Plus, Trash2, GitBranch, ChevronUp, ChevronDown } from 'lucide-react'

interface BranchCondition {
  label: string
  conditionExpression: string
  targetStepId: string
}

interface BranchConfigFormProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  /** Available steps in the same flow for target selection */
  availableSteps?: Array<{ id: string; name: string; stepOrder: number }>
}

export function BranchConfigForm({ config, onChange, availableSteps = [] }: BranchConfigFormProps) {
  const branches: BranchCondition[] = (config.branches as BranchCondition[]) ?? []
  const defaultTargetStepId = (config.defaultTargetStepId as string) ?? ''

  const updateBranches = (next: BranchCondition[]) => {
    onChange({ ...config, branches: next })
  }

  const addBranch = () => {
    updateBranches([...branches, { label: '', conditionExpression: '', targetStepId: '' }])
  }

  const updateBranch = (index: number, field: keyof BranchCondition, value: string) => {
    const next = branches.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    updateBranches(next)
  }

  const removeBranch = (index: number) => {
    updateBranches(branches.filter((_, i) => i !== index))
  }

  const moveBranch = (index: number, direction: -1 | 1) => {
    const newIdx = index + direction
    if (newIdx < 0 || newIdx >= branches.length) return
    const next = [...branches]
    ;[next[index], next[newIdx]] = [next[newIdx], next[index]]
    updateBranches(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-rose-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Branch Conditions</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">(evaluated in order, first match wins)</span>
      </div>

      {branches.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">No conditions yet. Add at least one branch condition.</p>
      )}

      {branches.map((branch, index) => (
        <div
          key={index}
          className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-900/10 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
              Condition {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveBranch(index, -1)}
                disabled={index === 0}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveBranch(index, 1)}
                disabled={index === branches.length - 1}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeBranch(index)}
                className="p-1 rounded text-gray-400 hover:text-red-500"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Label</label>
            <input
              value={branch.label}
              onChange={(e) => updateBranch(index, 'label', e.target.value)}
              placeholder="e.g. Has DUNS number"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Condition Expression</label>
            <textarea
              value={branch.conditionExpression}
              onChange={(e) => updateBranch(index, 'conditionExpression', e.target.value)}
              placeholder="e.g. working.dunsNumber != null"
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-y"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              JavaScript expression. Variables: <code className="px-0.5 rounded bg-gray-200 dark:bg-gray-700">request</code>, <code className="px-0.5 rounded bg-gray-200 dark:bg-gray-700">working</code>
            </p>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">Target Step</label>
            {availableSteps.length > 0 ? (
              <select
                value={branch.targetStepId}
                onChange={(e) => updateBranch(index, 'targetStepId', e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Select target step...</option>
                {availableSteps
                  .sort((a, b) => a.stepOrder - b.stepOrder)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.stepOrder} — {s.name}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                value={branch.targetStepId}
                onChange={(e) => updateBranch(index, 'targetStepId', e.target.value)}
                placeholder="UUID of target step"
                className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBranch}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 border border-dashed border-rose-300 dark:border-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Branch Condition
      </button>

      {/* Default path */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
          Default Path (when no condition matches)
        </label>
        {availableSteps.length > 0 ? (
          <select
            value={defaultTargetStepId}
            onChange={(e) => onChange({ ...config, defaultTargetStepId: e.target.value || undefined })}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            <option value="">(continue to next step by order)</option>
            {availableSteps
              .sort((a, b) => a.stepOrder - b.stepOrder)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.stepOrder} — {s.name}
                </option>
              ))}
          </select>
        ) : (
          <input
            value={defaultTargetStepId}
            onChange={(e) => onChange({ ...config, defaultTargetStepId: e.target.value || undefined })}
            placeholder="UUID of default target step (optional)"
            className="w-full px-2.5 py-1.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
        )}
      </div>
    </div>
  )
}
