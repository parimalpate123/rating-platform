import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Circle,
} from 'lucide-react';
import { customFlowsApi, type CustomFlow, type CustomFlowStep } from '../api/custom-flows';
import { productsApi, type ProductLine } from '../api/products';
import { cn } from '../lib/utils';

// Step types allowed in custom flows (plan: validate_request, generate_value, field_mapping, enrich)
const CUSTOM_FLOW_STEP_TYPES = [
  { value: 'validate_request', label: 'Validate Request' },
  { value: 'generate_value', label: 'Generate Value' },
  { value: 'field_mapping', label: 'Field Mapping' },
  { value: 'enrich', label: 'Enrich' },
];

const STEP_TYPE_COLORS: Record<string, string> = {
  validate_request: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700',
  generate_value: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700',
  field_mapping: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700',
  enrich: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700',
};

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
  placeholder?: string;
}

const CUSTOM_FLOW_STEP_CONFIG: Record<string, ConfigField[]> = {
  validate_request: [
    { key: 'schema', label: 'Schema Name', type: 'text', placeholder: 'e.g. rate-request' },
    { key: 'strictMode', label: 'Strict Mode', type: 'select', options: ['true', 'false'] },
  ],
  generate_value: [
    { key: 'targetPath', label: 'Target Path', type: 'text', placeholder: 'e.g. policy.ratingInstanceId' },
    { key: 'generator', label: 'Generator', type: 'select', options: ['uuid', 'timestamp'] },
  ],
  field_mapping: [
    { key: 'direction', label: 'Direction', type: 'select', options: ['request', 'response'] },
    { key: 'mappingId', label: 'Mapping ID', type: 'text', placeholder: 'UUID of mapping' },
  ],
  enrich: [
    { key: 'sourceField', label: 'Source Field (path)', type: 'text', placeholder: 'e.g. policy.state' },
    { key: 'tableKey', label: 'Lookup Table Key', type: 'text', placeholder: 'table name' },
    { key: 'targetField', label: 'Target Field (path)', type: 'text', placeholder: 'e.g. policy.enriched' },
  ],
};

function CustomFlowStepConfigForm({
  stepType,
  config,
  onChange,
}: {
  stepType: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const fields = CUSTOM_FLOW_STEP_CONFIG[stepType] ?? [];
  // Enrich uses lookups array; map single-row UI to lookups[0]
  const isEnrich = stepType === 'enrich';
  const effectiveConfig = isEnrich
    ? (config.lookups as Array<{ sourceField?: string; tableKey?: string; targetField?: string }>)?.[0] ?? {}
    : config;

  const handleChange = (key: string, value: string) => {
    if (isEnrich) {
      const lookup = { ...effectiveConfig, [key]: value };
      onChange({ ...config, lookups: [lookup] });
    } else {
      onChange({ ...config, [key]: value });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
          {f.type === 'select' ? (
            <select
              value={((effectiveConfig as Record<string, unknown>)[f.key] as string) ?? ''}
              onChange={(e) => handleChange(f.key, e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select...</option>
              {f.options?.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              value={((effectiveConfig as Record<string, unknown>)[f.key] as string) ?? ''}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function CustomFlowEdit() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const isNew = flowId === 'new';

  const [flow, setFlow] = useState<CustomFlow | null>(null);
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flow form (for create and edit)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'universal' | 'product'>('universal');
  const [productLineCode, setProductLineCode] = useState('');

  // Steps
  const [steps, setSteps] = useState<CustomFlowStep[]>([]);
  const [showAddStep, setShowAddStep] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepType, setNewStepType] = useState(CUSTOM_FLOW_STEP_TYPES[0].value);
  const [newStepConfig, setNewStepConfig] = useState<Record<string, unknown>>({});
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepData, setEditStepData] = useState<{
    name: string;
    stepType: string;
    config: Record<string, unknown>;
    isActive: boolean;
  }>({ name: '', stepType: '', config: {}, isActive: true });

  useEffect(() => {
    productsApi.list().then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      setFlow(null);
      setSteps([]);
      setName('');
      setDescription('');
      setScope('universal');
      setProductLineCode('');
      return;
    }
    if (!flowId) return;
    setLoading(true);
    setError(null);
    customFlowsApi
      .get(flowId)
      .then((data) => {
        setFlow(data);
        setName(data.name);
        setDescription(data.description ?? '');
        setScope(data.scope);
        setProductLineCode(data.productLineCode ?? '');
        setSteps(data.steps ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load flow'))
      .finally(() => setLoading(false));
  }, [flowId, isNew]);

  const handleCreateFlow = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await customFlowsApi.create({
        name: name.trim(),
        description: description.trim() || null,
        scope,
        productLineCode: scope === 'product' ? productLineCode || null : null,
      });
      navigate(`/custom-flows/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create flow');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFlow = async () => {
    if (!flow || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await customFlowsApi.update(flow.id, {
        name: name.trim(),
        description: description.trim() || null,
        scope,
        productLineCode: scope === 'product' ? productLineCode || null : null,
      });
      setFlow((prev) => prev ? { ...prev, name: name.trim(), description: description.trim() || null, scope, productLineCode: scope === 'product' ? productLineCode : null } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStep = async () => {
    if (!newStepName.trim() || !flow) return;
    setError(null);
    try {
      const created = await customFlowsApi.addStep(flow.id, {
        stepType: newStepType,
        name: newStepName.trim(),
        config: newStepConfig,
      });
      setSteps((prev) => [...prev.sort((a, b) => a.stepOrder - b.stepOrder), created].sort((a, b) => a.stepOrder - b.stepOrder));
      setShowAddStep(false);
      setNewStepName('');
      setNewStepType(CUSTOM_FLOW_STEP_TYPES[0].value);
      setNewStepConfig({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add step');
    }
  };

  const handleUpdateStep = async (stepId: string) => {
    if (!flow || !editStepData.name.trim()) return;
    setError(null);
    try {
      const updated = await customFlowsApi.updateStep(stepId, {
        name: editStepData.name.trim(),
        stepType: editStepData.stepType,
        config: editStepData.config,
        isActive: editStepData.isActive,
      });
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...updated } : s)));
      setEditingStepId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update step');
    }
  };

  const handleDeleteStep = async (stepId: string, stepName: string) => {
    if (!confirm(`Delete step "${stepName}"?`)) return;
    try {
      await customFlowsApi.deleteStep(stepId);
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete step');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!isNew && !flow) {
    return (
      <div className="p-6">
        <p className="text-red-600 dark:text-red-400">Flow not found.</p>
        <button
          onClick={() => navigate('/custom-flows')}
          className="mt-2 text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          Back to Custom Flows
        </button>
      </div>
    );
  }

  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const editingStep = editingStepId ? steps.find((s) => s.id === editingStepId) : null;

  return (
    <div className="p-6 w-full max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/custom-flows')}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {isNew ? 'New custom flow' : flow?.name ?? 'Edit flow'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Flow metadata */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Init rating instance"
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of what this flow does"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Scope</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scope === 'universal'}
                onChange={() => { setScope('universal'); setProductLineCode(''); }}
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Universal (any product)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scope === 'product'}
                onChange={() => setScope('product')}
                className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Specific to product</span>
            </label>
          </div>
        </div>
        {scope === 'product' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product</label>
            <select
              value={productLineCode}
              onChange={(e) => setProductLineCode(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select product...</option>
              {products.map((p) => (
                <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 pt-2">
          {isNew ? (
            <button
              onClick={handleCreateFlow}
              disabled={!name.trim() || (scope === 'product' && !productLineCode)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Create flow
            </button>
          ) : (
            <button
              onClick={handleSaveFlow}
              disabled={!name.trim() || (scope === 'product' && !productLineCode)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          )}
        </div>
      </div>

      {/* Steps (only when flow exists) */}
      {!isNew && flow && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Steps</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Allowed types: Validate Request, Generate Value, Field Mapping, Enrich.
          </p>

          <div className="space-y-2">
            {sortedSteps.map((step, index) => {
              const isEditing = editingStepId === step.id;
              const typeColor = STEP_TYPE_COLORS[step.stepType] ?? 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600';
              return (
                <div key={step.id} className={cn('rounded-lg border px-4 py-3', isEditing ? 'border-purple-300 dark:border-purple-600 ring-1 ring-purple-100 dark:ring-purple-800' : 'border-gray-200 dark:border-gray-700')}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">
                      {step.stepOrder}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', typeColor)}>
                        {step.stepType.replace(/_/g, ' ')}
                      </span>
                      <span className="ml-2 text-sm font-medium text-gray-800 dark:text-gray-200">{step.name}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {step.isActive ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />}
                      <button
                        onClick={() => {
                          if (isEditing) setEditingStepId(null);
                          else {
                            setEditingStepId(step.id);
                            setEditStepData({
                              name: step.name,
                              stepType: step.stepType,
                              config: { ...(step.config ?? {}) },
                              isActive: step.isActive,
                            });
                          }
                        }}
                        className="p-1.5 rounded text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                        title={isEditing ? 'Close' : 'Edit'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStep(step.id, step.name)}
                        className="p-1.5 rounded text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditing && editingStep && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step name</label>
                        <input
                          value={editStepData.name}
                          onChange={(e) => setEditStepData((p) => ({ ...p, name: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step type</label>
                        <select
                          value={editStepData.stepType}
                          onChange={(e) => setEditStepData((p) => ({ ...p, stepType: e.target.value, config: {} }))}
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                        >
                          {CUSTOM_FLOW_STEP_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <CustomFlowStepConfigForm
                        stepType={editStepData.stepType}
                        config={editStepData.config}
                        onChange={(c) => setEditStepData((p) => ({ ...p, config: c }))}
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <input
                          type="checkbox"
                          checked={editStepData.isActive}
                          onChange={(e) => setEditStepData((p) => ({ ...p, isActive: e.target.checked }))}
                          className="rounded border-gray-300 dark:border-gray-600 text-purple-600"
                        />
                        Active
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateStep(editingStep.id)}
                          disabled={!editStepData.name.trim()}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingStepId(null)}
                          className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {showAddStep ? (
            <div className="mt-4 p-4 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/20 space-y-3">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Add step</h4>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step name</label>
                <input
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  placeholder="e.g. Generate rating instance ID"
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Step type</label>
                <select
                  value={newStepType}
                  onChange={(e) => { setNewStepType(e.target.value); setNewStepConfig({}); }}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  {CUSTOM_FLOW_STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <CustomFlowStepConfigForm
                stepType={newStepType}
                config={newStepConfig}
                onChange={setNewStepConfig}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddStep}
                  disabled={!newStepName.trim()}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  Add step
                </button>
                <button
                  onClick={() => { setShowAddStep(false); setNewStepName(''); setNewStepType(CUSTOM_FLOW_STEP_TYPES[0].value); setNewStepConfig({}); }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddStep(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:text-purple-600 hover:border-purple-400 dark:hover:text-purple-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add step
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomFlowEdit;
