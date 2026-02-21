import React, { useState, useEffect } from 'react'
import {
  Loader2, Plus, Pencil, Trash2, X, Check, BookOpen,
  Sparkles, ChevronDown, ChevronRight, Zap,
} from 'lucide-react'
import {
  rulesApi, type Rule, type RuleCondition, type RuleAction,
  type RuleOperator, type ActionType, type ScopeTag,
} from '../../api/rules'
import { scopesApi, type ProductScope } from '../../api/scopes'
import { cn } from '../../lib/utils'

// ── Constants ────────────────────────────────────────────────────────────────

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: '==', label: 'equals (==)' },
  { value: '!=', label: 'not equals (!=)' },
  { value: '>', label: 'greater than (>)' },
  { value: '>=', label: '>= (gte)' },
  { value: '<', label: 'less than (<)' },
  { value: '<=', label: '<= (lte)' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in list' },
  { value: 'not_in', label: 'not in list' },
  { value: 'is_null', label: 'is null' },
  { value: 'is_not_null', label: 'is not null' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'surcharge', label: 'Surcharge (%)' },
  { value: 'discount', label: 'Discount (%)' },
  { value: 'multiply', label: 'Multiply By' },
  { value: 'set', label: 'Set Value' },
  { value: 'add', label: 'Add Amount' },
  { value: 'subtract', label: 'Subtract Amount' },
  { value: 'reject', label: 'Reject Quote' },
]

// ── AI Modal ─────────────────────────────────────────────────────────────────

function AIGenerateModal({
  productCode,
  onGenerated,
  onClose,
}: {
  productCode: string
  onGenerated: (rule: any, confidence: number) => void
  onClose: () => void
}) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    try {
      const result = await rulesApi.generateWithAI({ productLineCode: productCode, requirements: prompt })
      setConfidence(result.confidence)
      onGenerated(result.rule, result.confidence)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'AI generation failed. Check AWS Bedrock credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-semibold text-gray-900">Generate Rule with AI</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe the rule in plain English</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[
                {
                  label: '💰 Commission',
                  text: 'Set agent commission to 12% of premium for new business transactions in NY or NJ. Reduce commission to 8% if the insured annual revenue exceeds 5000000.',
                },
                {
                  label: '⚡ Surcharge',
                  text: 'Apply a 15% surcharge if the building age is over 30 years and the state is CA or TX. Apply an additional 10% surcharge if prior losses exceed 2 in the last 3 years.',
                },
              ].map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => setPrompt(sample.text)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  {sample.label}
                </button>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50 focus:bg-white resize-none"
              placeholder="e.g., Apply a 20% surcharge if the building age is over 40 years and located in California"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">Describe conditions and what should happen when met. Uses AWS Bedrock (Claude) or falls back to pattern matching.</p>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {confidence !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium">Generated with {Math.round(confidence * 100)}% confidence</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rule Editor Modal ────────────────────────────────────────────────────────

interface ConditionRow { field: string; operator: RuleOperator; value: string }
interface ActionRow { actionType: ActionType; targetField: string; value: string }

function RuleEditorModal({
  productCode,
  editingRule,
  onClose,
  onSaved,
}: {
  productCode: string
  editingRule: Rule | null
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !editingRule

  const [name, setName] = useState(editingRule?.name ?? '')
  const [description, setDescription] = useState(editingRule?.description ?? '')
  const [priority, setPriority] = useState(editingRule?.priority ?? 0)
  const [conditions, setConditions] = useState<ConditionRow[]>(
    editingRule?.conditions?.length
      ? editingRule.conditions.map((c) => ({ field: c.field, operator: c.operator as RuleOperator, value: String(c.value ?? '') }))
      : [{ field: '', operator: '==' as RuleOperator, value: '' }],
  )
  const [actions, setActions] = useState<ActionRow[]>(
    editingRule?.actions?.length
      ? editingRule.actions.map((a) => ({ actionType: a.actionType as ActionType, targetField: a.targetField, value: String(a.value ?? '') }))
      : [{ actionType: 'surcharge' as ActionType, targetField: 'premium', value: '' }],
  )
  const [scopeTags, setScopeTags] = useState<ScopeTag[]>([])
  const [productScopes, setProductScopes] = useState<ProductScope[]>([])
  const [newTagType, setNewTagType] = useState('state')
  const [newTagValue, setNewTagValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAI, setShowAI] = useState(false)

  // Load scope tags and product scopes
  useEffect(() => {
    if (editingRule) {
      rulesApi.listScopeTags(editingRule.id).then(setScopeTags).catch(() => {})
    }
    scopesApi.list(productCode).then(setProductScopes).catch(() => {})
  }, [editingRule, productCode])

  // Condition helpers
  const updateCond = (i: number, patch: Partial<ConditionRow>) =>
    setConditions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)))
  const addCond = () => setConditions((prev) => [...prev, { field: '', operator: '==' as RuleOperator, value: '' }])
  const removeCond = (i: number) => setConditions((prev) => prev.filter((_, idx) => idx !== i))

  // Action helpers
  const updateAction = (i: number, patch: Partial<ActionRow>) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  const addAction = () => setActions((prev) => [...prev, { actionType: 'surcharge' as ActionType, targetField: 'premium', value: '' }])
  const removeAction = (i: number) => setActions((prev) => prev.filter((_, idx) => idx !== i))

  // Save
  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        description: description || undefined,
        priority,
        productLineCode: productCode,
        isActive: editingRule?.isActive ?? false,
        conditions: conditions.filter((c) => c.field.trim()).map((c, i) => ({
          field: c.field,
          operator: c.operator,
          value: c.operator === 'is_null' || c.operator === 'is_not_null' ? null : c.value,
          logicalGroup: 0,
        })),
        actions: actions.filter((a) => a.targetField.trim() || a.actionType === 'reject').map((a, i) => ({
          actionType: a.actionType,
          targetField: a.targetField,
          value: a.value,
          sortOrder: i,
        })),
      }
      if (isNew) {
        await rulesApi.create(payload)
      } else {
        await rulesApi.update(editingRule!.id, payload)
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // AI callback
  const handleAIGenerated = (rule: any, confidence: number) => {
    if (rule.name) setName(rule.name)
    if (rule.description) setDescription(rule.description)
    if (rule.conditions?.length) {
      setConditions(rule.conditions.map((c: any) => ({
        field: c.field ?? '',
        operator: (c.operator ?? '==') as RuleOperator,
        value: String(c.value ?? ''),
      })))
    }
    if (rule.actions?.length) {
      setActions(rule.actions.map((a: any) => ({
        actionType: (a.actionType ?? 'surcharge') as ActionType,
        targetField: a.targetField ?? 'premium',
        value: String(a.value ?? ''),
      })))
    }
    setShowAI(false)
  }

  // Scope tag helpers
  const handleAddTag = async () => {
    if (!editingRule || !newTagValue.trim()) return
    try {
      const tag = await rulesApi.addScopeTag(editingRule.id, { scopeType: newTagType, scopeValue: newTagValue })
      setScopeTags((prev) => [...prev, tag])
      setNewTagValue('')
    } catch {}
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!editingRule) return
    await rulesApi.deleteScopeTag(editingRule.id, tagId)
    setScopeTags((prev) => prev.filter((t) => t.id !== tagId))
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white'
  const selectCls = 'px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white'

  // Available scope values grouped by type
  const scopeValuesByType = new Map<string, string[]>()
  for (const s of productScopes) {
    if (!scopeValuesByType.has(s.scopeType)) scopeValuesByType.set(s.scopeType, [])
    scopeValuesByType.get(s.scopeType)!.push(s.scopeValue)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{isNew ? 'New Rule' : 'Edit Rule'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{productCode}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAI(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Generate with AI
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

          {/* Basic info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule Details</h3>
            <div className="grid grid-cols-[1fr_100px] gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g., High_Revenue_Surcharge" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputCls + ' resize-none'} placeholder="Describe what this rule does..." />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Conditions <span className="text-blue-600 font-bold ml-1">(IF)</span>
              </h3>
              <button onClick={addCond} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                <Plus className="w-3 h-3" /> Add Condition
              </button>
            </div>
            <div className="text-[10px] text-gray-400 uppercase grid grid-cols-[1fr_130px_1fr_28px] gap-2 px-1">
              <span>Field path</span><span>Operator</span><span>Value</span><span />
            </div>
            {conditions.map((cond, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-[10px] font-bold text-purple-600 pl-1">AND</span>}
                <div className="grid grid-cols-[1fr_130px_1fr_28px] gap-2 items-center">
                  <input value={cond.field} onChange={(e) => updateCond(i, { field: e.target.value })} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" placeholder="insured.state" />
                  <select value={cond.operator} onChange={(e) => updateCond(i, { operator: e.target.value as RuleOperator })} className={selectCls}>
                    {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                  <input value={cond.value} onChange={(e) => updateCond(i, { value: e.target.value })} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" placeholder="NY" disabled={cond.operator === 'is_null' || cond.operator === 'is_not_null'} />
                  <button onClick={() => removeCond(i)} disabled={conditions.length === 1} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Actions <span className="text-green-600 font-bold ml-1">(THEN)</span>
              </h3>
              <button onClick={addAction} className="flex items-center gap-1 text-xs font-medium text-green-600 hover:text-green-800">
                <Plus className="w-3 h-3" /> Add Action
              </button>
            </div>
            <div className="text-[10px] text-gray-400 uppercase grid grid-cols-[140px_1fr_1fr_28px] gap-2 px-1">
              <span>Action type</span><span>Target field</span><span>Value</span><span />
            </div>
            {actions.map((act, i) => (
              <div key={i} className="grid grid-cols-[140px_1fr_1fr_28px] gap-2 items-center">
                <select value={act.actionType} onChange={(e) => updateAction(i, { actionType: e.target.value as ActionType })} className={selectCls}>
                  {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input value={act.targetField} onChange={(e) => updateAction(i, { targetField: e.target.value })} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" placeholder="premium" disabled={act.actionType === 'reject'} />
                <input value={act.value} onChange={(e) => updateAction(i, { value: e.target.value })} className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50" placeholder={act.actionType === 'reject' ? 'reason' : '0.20'} />
                <button onClick={() => removeAction(i)} disabled={actions.length === 1} className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Rule Preview */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Rule Preview</h3>
            <div className="font-mono text-sm space-y-0.5">
              <div className="text-blue-600 font-semibold">IF</div>
              {conditions.map((c, i) => (
                <div key={i} className="pl-4">
                  {i > 0 && <span className="text-purple-600">AND </span>}
                  <span className="text-gray-700">{c.field || '?'} </span>
                  <span className="text-orange-500">{c.operator} </span>
                  <span className="text-green-600">{c.value || '?'}</span>
                </div>
              ))}
              <div className="text-green-600 font-semibold mt-1">THEN</div>
              {actions.map((a, i) => (
                <div key={i} className="pl-4">
                  <span className="text-purple-600">{a.actionType} </span>
                  <span className="text-gray-700">{a.targetField || '?'} </span>
                  <span className="text-green-600">{a.value || '?'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scope Tags (only for editing existing rules) */}
          {!isNew && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope Tags</h3>
              <div className="flex items-center flex-wrap gap-2">
                {scopeTags.map((tag) => (
                  <span key={tag.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                    {tag.scopeType}={tag.scopeValue}
                    <button onClick={() => handleDeleteTag(tag.id)} className="ml-0.5 text-indigo-400 hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {scopeTags.length === 0 && <span className="text-xs text-gray-400">No scope tags — rule applies to all requests</span>}
              </div>
              <div className="flex items-center gap-2">
                <select value={newTagType} onChange={(e) => { setNewTagType(e.target.value); setNewTagValue('') }} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50">
                  <option value="state">State</option>
                  <option value="coverage">Coverage</option>
                  <option value="transaction_type">Transaction Type</option>
                </select>
                {(scopeValuesByType.get(newTagType)?.length ?? 0) > 0 ? (
                  <select value={newTagValue} onChange={(e) => setNewTagValue(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50">
                    <option value="">Select value...</option>
                    {(scopeValuesByType.get(newTagType) ?? []).map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                ) : (
                  <input value={newTagValue} onChange={(e) => setNewTagValue(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50" placeholder="Type value..." />
                )}
                <button onClick={handleAddTag} disabled={!newTagValue.trim()} className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
                  + Add Tag
                </button>
              </div>
              <p className="text-[10px] text-gray-400">Tags restrict when this rule fires. Configure available scope values in the Scopes tab first.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? 'Saving...' : isNew ? 'Create Rule' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* AI sub-modal */}
      {showAI && <AIGenerateModal productCode={productCode} onGenerated={handleAIGenerated} onClose={() => setShowAI(false)} />}
    </div>
  )
}

// ── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onActivate,
}: {
  rule: Rule
  onEdit: () => void
  onDelete: () => void
  onActivate: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800">{rule.name}</span>
            <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', rule.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
              {rule.isActive ? 'active' : 'draft'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
              priority: {rule.priority}
            </span>
          </div>
          {rule.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.description}</p>}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0">
          {rule.conditions?.length ?? 0} condition{(rule.conditions?.length ?? 0) !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!rule.isActive && (
            <button onClick={onActivate} title="Activate" className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50">
              <Zap className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3">
          <div className="font-mono text-xs space-y-0.5">
            <div className="text-blue-600 font-semibold">IF</div>
            {(rule.conditions ?? []).map((c, i) => (
              <div key={i} className="pl-4">
                {i > 0 && <span className="text-purple-600">AND </span>}
                <span className="text-gray-700">{c.field} </span>
                <span className="text-orange-500">{c.operator} </span>
                <span className="text-green-600">{String(c.value ?? '')}</span>
              </div>
            ))}
            <div className="text-green-600 font-semibold mt-1">THEN</div>
            {(rule.actions ?? []).map((a, i) => (
              <div key={i} className="pl-4">
                <span className="text-purple-600">{a.actionType} </span>
                <span className="text-gray-700">{a.targetField} </span>
                <span className="text-green-600">{String(a.value ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function RulesTab({ productCode }: { productCode: string }) {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)

  const loadRules = () => {
    setLoading(true)
    rulesApi
      .list(productCode)
      .then(setRules)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load rules'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRules() }, [productCode])

  const handleEdit = (rule: Rule) => { setEditingRule(rule); setEditorOpen(true) }
  const handleNew = () => { setEditingRule(null); setEditorOpen(true) }
  const handleDelete = async (rule: Rule) => {
    await rulesApi.delete(rule.id)
    loadRules()
  }
  const handleActivate = async (rule: Rule) => {
    await rulesApi.activate(rule.id)
    loadRules()
  }
  const handleSaved = () => { setEditorOpen(false); setEditingRule(null); loadRules() }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
        <button onClick={handleNew} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No rules yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Create rules to apply business logic during rating. You can also use AI to generate rules from plain-English descriptions.
          </p>
          <button onClick={handleNew} className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New Rule
          </button>
        </div>
      )}

      {rules.map((rule) => (
        <RuleCard key={rule.id} rule={rule} onEdit={() => handleEdit(rule)} onDelete={() => handleDelete(rule)} onActivate={() => handleActivate(rule)} />
      ))}

      {editorOpen && (
        <RuleEditorModal productCode={productCode} editingRule={editingRule} onClose={() => { setEditorOpen(false); setEditingRule(null) }} onSaved={handleSaved} />
      )}
    </div>
  )
}
