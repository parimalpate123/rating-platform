import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Play, Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { ratingApi, type RateResponse } from '../api/orchestrator';
import { type ProductLine } from '../api/products';
import { cn, statusColor } from '../lib/utils';
import { ExecutionFlowDiagram, type DiagramStep, type DiagramResult } from '../components/flow/ExecutionFlowDiagram';
import { StepDetailPanel } from '../components/flow/StepDetailPanel';

const DEFAULT_PAYLOAD = JSON.stringify({
  policy: {
    insuredName: 'ACME Corporation',
    annualRevenue: 5000000,
    employeeCount: 50,
    state: 'NY',
    effectiveDate: new Date().toISOString().split('T')[0],
  },
  coverage: {
    type: 'BOP',
    limit: 1000000,
    deductible: 5000,
  },
}, null, 2);

export function TestRating() {
  const { products } = useOutletContext<{ products: ProductLine[] }>();
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState('');
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [state, setState] = useState('');
  const [coverage, setCoverage] = useState('');
  const [transactionType, setTransactionType] = useState('new_business');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [selectedStep, setSelectedStep] = useState<{ step: DiagramStep; result?: DiagramResult } | null>(null);

  const handleRun = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setExpandedSteps(new Set());
    try {
      let parsedPayload: Record<string, unknown>;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        setError('Invalid JSON payload');
        setLoading(false);
        return;
      }
      const scope: Record<string, string> = {};
      if (state) scope['state'] = state;
      if (coverage) scope['coverage'] = coverage;
      if (transactionType) scope['transactionType'] = transactionType;

      const res = await ratingApi.rate(selectedProduct, parsedPayload, Object.keys(scope).length > 0 ? scope : undefined);
      setResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Rating request failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (i: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          Test Rating Execution
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Submit a test rating request and see the step-by-step execution trace.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left — Input */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Request</h2>

            {/* Product selector */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Product Line</label>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </select>
              {products.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  No products yet.{' '}
                  <button onClick={() => navigate('/products')} className="underline">Create one first.</button>
                </p>
              )}
            </div>

            {/* Scope */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input
                  value={state} onChange={e => setState(e.target.value)}
                  placeholder="e.g. NY"
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coverage</label>
                <input
                  value={coverage} onChange={e => setCoverage(e.target.value)}
                  placeholder="e.g. BOP"
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Transaction</label>
                <select
                  value={transactionType} onChange={e => setTransactionType(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="new_business">New Business</option>
                  <option value="renewal">Renewal</option>
                  <option value="endorsement">Endorsement</option>
                </select>
              </div>
            </div>

            {/* Payload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payload (JSON)</label>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              onClick={handleRun}
              disabled={!selectedProduct || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Running...</>
              ) : (
                <><Play className="w-4 h-4" /> Run Rating</>
              )}
            </button>
          </div>
        </div>

        {/* Right — Output */}
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Summary card */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-800">Result</h2>
                  <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium', statusColor(result.status.toUpperCase()))}>
                    {result.status === 'completed'
                      ? <CheckCircle className="w-3 h-3" />
                      : <XCircle className="w-3 h-3" />}
                    {result.status}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {(result.response as any)?.premium && (
                    <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <dt className="text-xs font-medium text-green-600 uppercase tracking-wide">Premium</dt>
                      <dd className="text-2xl font-bold text-green-700 mt-0.5">
                        ${(result.response as any).premium.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs text-gray-500">Transaction ID</dt>
                    <dd className="font-mono text-xs text-gray-700 truncate">{result.transactionId}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Duration</dt>
                    <dd className="text-gray-700">{result.totalDurationMs}ms</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Steps</dt>
                    <dd className="text-gray-700">{result.stepResults.length} executed</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Correlation ID</dt>
                    <dd className="font-mono text-xs text-gray-700 truncate">{result.correlationId.slice(0, 8)}...</dd>
                  </div>
                </dl>
              </div>

              {/* Execution flow diagram */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">
                  Execution Flow
                  <span className="ml-2 text-xs font-normal text-gray-400">· click a node to inspect</span>
                </h2>
                <ExecutionFlowDiagram
                  steps={result.stepResults.map((s, i) => ({
                    id: s.stepId,
                    name: s.stepName,
                    stepType: s.stepType,
                    stepOrder: i + 1,
                  }))}
                  results={result.stepResults.map((s) => ({
                    stepId: s.stepId,
                    stepName: s.stepName,
                    stepType: s.stepType,
                    status: s.status,
                    durationMs: s.durationMs,
                    error: s.error,
                    output: s.output,
                  }))}
                  onStepClick={(step, res) => setSelectedStep({ step, result: res })}
                  selectedStepId={selectedStep?.step.id}
                />
              </div>

              {/* Step trace */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-3">Step Trace</h2>
                <div className="space-y-1">
                  {result.stepResults.map((step, i) => (
                    <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleStep(i)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 flex-shrink-0">
                          {i + 1}
                        </span>
                        {step.status === 'completed'
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          : step.status === 'skipped'
                          ? <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          : <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                        <span className="text-sm text-gray-800 flex-1 text-left">{step.stepName}</span>
                        <span className="text-xs text-gray-400">{step.durationMs}ms</span>
                        {expandedSteps.has(i)
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                      {expandedSteps.has(i) && (
                        <div className="px-3 pb-3 pt-1 bg-gray-50 border-t border-gray-100">
                          <p className="text-xs text-gray-500 mb-1">Type: <span className="font-mono">{step.stepType}</span></p>
                          {step.error && <p className="text-xs text-red-600">Error: {step.error}</p>}
                          {step.output && (
                            <pre className="text-xs bg-white border border-gray-200 rounded p-2 mt-1 overflow-auto max-h-32">
                              {JSON.stringify(step.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!result && !error && !loading && (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
              <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Results will appear here after running a test</p>
            </div>
          )}
        </div>
      </div>

      {selectedStep && (
        <StepDetailPanel
          step={selectedStep.step}
          result={selectedStep.result}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </div>
  );
}

export default TestRating;
