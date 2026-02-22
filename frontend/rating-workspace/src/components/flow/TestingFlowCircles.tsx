import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, X, Copy, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getServiceLabel } from './ExecutionFlowDiagram';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestingFlowStep {
  id: string;
  name: string;
  stepType: string;
  stepOrder: number;
  config?: Record<string, unknown>;
}

export interface TestingFlowStepResult {
  stepId?: string;
  stepName?: string;
  stepType?: string;
  status: string;
  durationMs: number;
  error?: string;
  output?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isXml(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith('<') && trimmed.includes('>');
}

function formatBlock(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && isXml(value)) return value;
  return JSON.stringify(value, null, 2);
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-700 text-xs flex items-center gap-1"
    >
      <Copy className="w-3 h-3" />
      {copied ? 'Copied' : label}
    </button>
  );
}

function getHttpStatusBadge(httpStatus: number | undefined) {
  if (!httpStatus) return null;
  const isOk = httpStatus >= 200 && httpStatus < 300;
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ml-2',
        isOk ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
      )}
    >
      HTTP {httpStatus}
    </span>
  );
}

// ── Modal: shows actual service request, response, and HTTP status ───────────

interface TestStepDetailModalProps {
  step: TestingFlowStep;
  stepIndex: number;
  result?: TestingFlowStepResult;
  onClose: () => void;
}

function TestStepDetailModal({
  step,
  stepIndex,
  result,
  onClose,
}: TestStepDetailModalProps) {
  const output = result?.output ?? {};
  const serviceRequest = (output as any).serviceRequest;
  const serviceResponse = (output as any).serviceResponse;
  const httpStatus = (output as any).httpStatus as number | undefined;
  const status = result?.status ?? 'unknown';
  const error = result?.error;

  const requestStr = formatBlock(serviceRequest);
  const responseStr = formatBlock(serviceResponse);
  const requestIsXml = isXml(serviceRequest);
  const responseIsXml = isXml(serviceResponse);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Step {stepIndex + 1}: {step.name}
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{step.stepType.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* Status + HTTP status */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Status</p>
            <div className="flex items-center">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                  status === 'completed' && 'bg-green-100 text-green-700',
                  status === 'failed' && 'bg-red-100 text-red-700',
                  !['completed', 'failed'].includes(status) && 'bg-gray-100 text-gray-700',
                )}
              >
                {status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
                {status === 'failed' && <XCircle className="w-3.5 h-3.5" />}
                {status}
              </span>
              {getHttpStatusBadge(httpStatus)}
            </div>
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          {/* Request */}
          <div className="relative">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Request</p>
            <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[60px]">
              {requestStr && <CopyButton text={requestStr} label="Copy request" />}
              <pre
                className={cn(
                  'text-xs font-mono overflow-auto max-h-48 pr-20',
                  requestIsXml ? 'whitespace-pre-wrap' : 'text-gray-700',
                )}
              >
                {requestStr || <span className="text-gray-400 italic">No request captured</span>}
              </pre>
            </div>
          </div>

          {/* Response */}
          <div className="relative">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Response</p>
            <div className="relative bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[60px]">
              {responseStr && <CopyButton text={responseStr} label="Copy response" />}
              <pre
                className={cn(
                  'text-xs font-mono overflow-auto max-h-48 pr-20',
                  responseIsXml ? 'whitespace-pre-wrap' : 'text-gray-700',
                )}
              >
                {responseStr || (
                  <span className="text-gray-400 dark:text-gray-500 italic">
                    {error ? `Failed: ${error}` : 'No response captured'}
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Circle row (dynamic from orchestrator steps) ────────────────────────────────

export interface TestingFlowCirclesProps {
  steps: TestingFlowStep[];
  stepResults?: TestingFlowStepResult[];
  testPayloadJson?: string;
  onStepClick?: (step: TestingFlowStep, index: number) => void;
}

export function TestingFlowCircles({
  steps,
  stepResults = [],
  onStepClick,
}: TestingFlowCirclesProps) {
  const [modalStep, setModalStep] = useState<{ step: TestingFlowStep; index: number } | null>(null);

  const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

  const getResultForIndex = (index: number): TestingFlowStepResult | undefined => {
    const step = sortedSteps[index];
    if (!step) return undefined;
    return stepResults.find((r) => r.stepId === step.id) ?? stepResults[index];
  };

  const handleCircleClick = (step: TestingFlowStep, index: number) => {
    setModalStep({ step, index });
    onStepClick?.(step, index);
  };

  if (sortedSteps.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-1 flex-wrap">
        {sortedSteps.map((step, index) => {
          const result = getResultForIndex(index);
          const status = result?.status?.toLowerCase();
          const serviceLabel = getServiceLabel(step.stepType, step.config);
          const isFailed = status === 'failed';
          const title = isFailed && result?.error
            ? `${step.name} · Failed: ${result.error}`
            : `${step.name} · ${serviceLabel}`;

          const nodeContent = result ? (
            isFailed ? (
              <AlertCircle className="w-4 h-4 text-red-600" aria-label="Failed" />
            ) : status === 'completed' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <span className="text-[10px] font-bold">{index + 1}</span>
            )
          ) : (
            <span className="text-[10px] font-bold">{index + 1}</span>
          );

          const nodeClass = isFailed
            ? 'w-9 h-9 rounded-lg border-2 border-red-400 bg-red-50 flex items-center justify-center flex-shrink-0 transition-colors shadow-sm'
            : cn(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                status === 'completed' && 'bg-green-100 border-green-400 text-green-700',
                !result && 'bg-white border-gray-300 text-gray-400',
              );

          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className="flex items-center flex-shrink-0 self-start mt-4 text-gray-400" aria-hidden>
                  <div className="w-3 h-0.5 bg-gray-400 rounded-full" />
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </div>
              )}
              <div className="flex flex-col items-center gap-1.5 min-w-[4rem]">
                <button
                  type="button"
                  onClick={() => handleCircleClick(step, index)}
                  className={nodeClass}
                  title={title}
                >
                  {nodeContent}
                </button>
                <span
                  className={cn(
                    'text-[10px] font-medium text-center leading-tight max-w-[5.5rem] break-words',
                    isFailed ? 'text-red-600' : 'text-gray-600',
                  )}
                  title={isFailed && result?.error ? result.error : undefined}
                >
                  {serviceLabel}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {modalStep && (
        <TestStepDetailModal
          step={modalStep.step}
          stepIndex={modalStep.index}
          result={getResultForIndex(modalStep.index)}
          onClose={() => setModalStep(null)}
        />
      )}
    </>
  );
}
