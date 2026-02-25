import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Target,
  Server,
  GitBranch,
  Settings,
  Map,
  Zap,
  ArrowRight,
  HelpCircle,
  Workflow,
} from 'lucide-react';
import { cn } from '../lib/utils';

type Frequency = 'once' | 'per-release' | 'ongoing';

interface StepItem {
  step: number;
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  path: string;
  pathLabel?: string;
  frequency: Frequency;
}

const FREQUENCY_LABELS: Record<Frequency, string> = {
  once: 'Once',
  'per-release': 'Per release',
  ongoing: 'Ongoing',
};

const STEPS: StepItem[] = [
  {
    step: 1,
    icon: Package,
    title: 'Configure product',
    description: 'Create or edit a product line (name, source/target system, owner). Product lines group rating configuration.',
    action: 'Product Lines',
    path: '/products',
    pathLabel: 'Open Product Lines',
    frequency: 'once',
  },
  {
    step: 2,
    icon: Target,
    title: 'Configure scopes',
    description: 'Define scope dimensions (e.g. state, coverage, transaction type) for the product. Used to filter and segment rating.',
    action: 'Product → Scopes tab',
    path: '/products',
    pathLabel: 'Open Products',
    frequency: 'per-release',
  },
  {
    step: 3,
    icon: Server,
    title: 'Add systems',
    description: 'Register source and target systems (URLs, auth). Systems are used by orchestrator steps to call rating engines and APIs.',
    action: 'Systems Registry',
    path: '/systems',
    pathLabel: 'Open Systems',
    frequency: 'once',
  },
  {
    step: 4,
    icon: Workflow,
    title: 'Custom flows (optional)',
    description: 'Create reusable sub-flows (validate, generate value, field mapping, enrich) under Configuration. Use them in the product Orchestrator via a "Run custom flow" step.',
    action: 'Custom Flows',
    path: '/custom-flows',
    pathLabel: 'Open Custom Flows',
    frequency: 'per-release',
  },
  {
    step: 5,
    icon: GitBranch,
    title: 'Add orchestrator flow',
    description: 'In the product Orchestrator tab: create a flow (e.g. /rate) and add or auto-generate steps (validate, map, rating rules, call engine, run custom flow, etc.).',
    action: 'Product → Orchestrator tab',
    path: '/products',
    pathLabel: 'Open Products',
    frequency: 'once',
  },
  {
    step: 6,
    icon: Settings,
    title: 'Configure step activity',
    description: 'For each step, set activity type: one-time (runs once per request) or iterative (runs per item in a list). Edit the step to change this.',
    action: 'In Orchestrator → edit step',
    path: '/products',
    pathLabel: 'Open Products',
    frequency: 'per-release',
  },
  {
    step: 7,
    icon: Map,
    title: 'Mappings & rating rules',
    description: 'Add field mappings (request/response) and rating rules per product. Link them in the orchestrator step config.',
    action: 'Product → Mappings / Rating Rules tabs',
    path: '/products',
    pathLabel: 'Open Products',
    frequency: 'ongoing',
  },
  {
    step: 8,
    icon: Zap,
    title: 'Run a test rating',
    description: 'Use Test Rating to submit a payload and see the execution trace. Check Transactions and Insights for history.',
    action: 'Test Rating',
    path: '/test',
    pathLabel: 'Open Test Rating',
    frequency: 'ongoing',
  },
];

function StepCard({ item, isLast }: { item: StepItem; isLast: boolean }) {
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <div className="flex gap-4">
      {/* Timeline: number + line */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-500 dark:border-purple-400 flex items-center justify-center">
          <span className="text-sm font-bold text-purple-700 dark:text-purple-300">{item.step}</span>
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[24px] bg-purple-200 dark:bg-purple-800 mt-2" />
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          'flex-1 pb-8',
          isLast && 'pb-0',
        )}
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{item.title}</h3>
                  <span
                    className={cn(
                      'inline-flex px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide',
                      item.frequency === 'once' && 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
                      item.frequency === 'per-release' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
                      item.frequency === 'ongoing' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                    )}
                  >
                    {FREQUENCY_LABELS[item.frequency]}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{item.description}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2 font-medium">{item.action}</p>
              </div>
            </div>
            <button
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
                'bg-purple-600 text-white hover:bg-purple-700 transition-colors flex-shrink-0',
              )}
            >
              {item.pathLabel ?? 'Go'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GettingStarted() {
  return (
    <div className="px-4 py-4 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/40">
          <HelpCircle className="w-7 h-7 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Getting Started</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Follow these steps to configure and run rating. Each step links to the right place in the app.
          </p>
        </div>
      </div>

      {/* Visual flow */}
      <div className="relative">
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          Step-by-step flow
        </h2>
        <div className="space-y-0">
          {STEPS.map((item, idx) => (
            <StepCard key={item.step} item={item} isLast={idx === STEPS.length - 1} />
          ))}
        </div>
      </div>

      {/* Short tip */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-3 text-sm text-purple-800 dark:text-purple-200">
        <p className="font-medium">Tip</p>
        <p className="mt-0.5 text-purple-700 dark:text-purple-300">
          Product-level items (scopes, orchestrator, mappings, rating rules) are under each product in the sidebar. Open a product line to see its Orchestrator, Mappings, Rating Rules, and Scopes tabs.
        </p>
      </div>
    </div>
  );
}

export default GettingStarted;
