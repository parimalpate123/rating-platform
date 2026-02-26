import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workflow, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { customFlowsApi, type CustomFlow } from '../api/custom-flows';
import { cn } from '../lib/utils';

export function CustomFlows() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<CustomFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    customFlowsApi
      .list()
      .then(setFlows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load custom flows'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (flow: CustomFlow) => {
    if (!confirm(`Delete custom flow "${flow.name}"? This cannot be undone.`)) return;
    try {
      await customFlowsApi.delete(flow.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete flow');
    }
  };

  return (
    <div className="p-6 w-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Workflow className="w-5 h-5 text-purple-500" />
            Custom Flows
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reusable sub-flows (validate, generate value, field mapping, enrich) that can be run as a single step in a product orchestrator.
          </p>
        </div>
        <button
          onClick={() => navigate('/custom-flows/new')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add custom flow
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading custom flows…</span>
        </div>
      ) : flows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Workflow className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">No custom flows yet.</p>
          <button
            onClick={() => navigate('/custom-flows/new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add custom flow
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {flows.map((flow) => (
            <li
              key={flow.id}
              className={cn(
                'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700',
                'px-5 py-4 flex items-center gap-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {flow.name}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      flow.scope === 'universal'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                    )}
                  >
                    {flow.scope === 'universal'
                      ? 'Universal'
                      : `Product: ${flow.productLineCode ?? '—'}`}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {(flow.steps ?? []).length} step{(flow.steps ?? []).length !== 1 ? 's' : ''}
                  </span>
                </div>
                {flow.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {flow.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate(`/custom-flows/${flow.id}`)}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(flow)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CustomFlows;
