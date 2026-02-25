import { useState, useEffect } from 'react';
import {
  Bot, Save, RotateCcw, ChevronDown, ChevronUp,
  Info, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import { aiPromptsApi, AiPrompt } from '../api/ai-prompts';

// ── Variable pill ─────────────────────────────────────────────────────────────

function VarPill({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
      {`{{${name}}}`}
    </span>
  );
}

// ── Prompt card ───────────────────────────────────────────────────────────────

function PromptCard({ prompt, onUpdated }: { prompt: AiPrompt; onUpdated: (p: AiPrompt) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleEdit = () => {
    setDraft(prompt.template);
    setEditing(true);
    setExpanded(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await aiPromptsApi.update(prompt.key, { template: draft });
      onUpdated(updated);
      setEditing(false);
      showToast('success', 'Prompt saved. New version will be used on next AI call.');
    } catch {
      showToast('error', 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(`Reset "${prompt.name}" to hardcoded default? The current override will be removed.`)) return;
    setResetting(true);
    try {
      const updated = await aiPromptsApi.reset(prompt.key) as any;
      if (updated?.template) onUpdated(updated);
      showToast('success', 'Reset to hardcoded default.');
    } catch {
      showToast('error', 'Reset failed.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 mt-0.5 w-8 h-8 bg-violet-100 dark:bg-violet-900/30 rounded-lg flex items-center justify-center">
            <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{prompt.name}</h3>
              <span className="text-xs text-gray-400 font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {prompt.key}
              </span>
              <span className="text-xs text-gray-400">v{prompt.version}</span>
            </div>
            {prompt.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{prompt.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {prompt.variables.map((v) => <VarPill key={v} name={v} />)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {!editing && (
            <button
              onClick={handleEdit}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => setExpanded((x) => !x)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-5 mb-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
          toast.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <AlertCircle className="h-3.5 w-3.5" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Body */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-4 space-y-3">
          {editing ? (
            <>
              <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  Use <code className="font-mono">{'{{variableName}}'}</code> placeholders.{' '}
                  <code className="font-mono">{'{{knowledge_context}}'}</code> will be filled by RAG when Bedrock KB is enabled.
                </span>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                className="w-full font-mono text-xs bg-gray-900 text-gray-100 border border-gray-700 rounded-lg p-4 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y"
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Prompt'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset to default</span>
                </button>
              </div>
            </>
          ) : (
            <pre className="font-mono text-xs bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-5">
              {prompt.template}
            </pre>
          )}

          {prompt.kbQueryTemplate && (
            <div className="flex items-start gap-2 text-xs bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 text-violet-700 dark:text-violet-400">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium">RAG enabled —</span> retrieves top {prompt.kbTopK} KB chunks using query:{' '}
                <code className="font-mono">{prompt.kbQueryTemplate}</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AiPrompts() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    aiPromptsApi
      .list()
      .then(setPrompts)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdated = (updated: AiPrompt) =>
    setPrompts((prev) => prev.map((p) => (p.key === updated.key ? updated : p)));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Prompts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage the prompt templates used by AI features across the platform. Changes take effect immediately — no deployment needed.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="h-4 w-4" />
          Under development
        </span>
      </div>

      {/* RAG notice */}
      <div className="flex items-start gap-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-4 py-3 text-sm text-violet-800 dark:text-violet-300">
        <Bot className="h-5 w-5 mt-0.5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
        <div className="space-y-1">
          <p className="font-medium">RAG Enrichment (Phase 2)</p>
          <p className="text-xs text-violet-700 dark:text-violet-400">
            The{' '}
            <code className="font-mono text-xs bg-violet-100 dark:bg-violet-900/40 px-1 rounded">
              {'{{knowledge_context}}'}
            </code>{' '}
            placeholder in each template is reserved for Bedrock Knowledge Base retrieval. Once AWS Bedrock KB is enabled,
            relevant document chunks from the Knowledge Base will be automatically injected here at inference time.
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-600 dark:text-red-400 text-sm">
          Failed to load prompts. Is rules-service running?
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {prompts.map((p) => (
            <PromptCard key={p.key} prompt={p} onUpdated={handleUpdated} />
          ))}
          {prompts.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No AI prompts found. Run database migration 007 to seed the default prompts.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
