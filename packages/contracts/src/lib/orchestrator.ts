// ─── Orchestrator Contracts ─────────────────────────────────────────────────
// Defines the flow structure and step types for product-level orchestration.

export type OrchestratorStepType =
  | 'field_mapping'
  | 'apply_rules'
  | 'format_transform'
  | 'call_rating_engine'
  | 'call_external_api'
  | 'call_orchestrator'
  | 'publish_event'
  | 'enrich';

export type ImplementationType = 'built_in' | 'library' | 'external_api';

export type FormatDirection =
  | 'json_to_xml'
  | 'xml_to_json'
  | 'json_to_soap'
  | 'soap_to_json';

export type OnFailureAction = 'stop' | 'skip' | 'use_default';

export interface StepCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'exists';
  value: unknown;
}

export interface StepRetryConfig {
  maxAttempts: number;
  backoffMs: number;
  multiplier: number;
}

export interface StepCircuitBreakerConfig {
  failureThreshold: number;
  resetAfterMs: number;
}

export interface StepResilienceConfig {
  timeout?: number;
  retry?: StepRetryConfig;
  circuitBreaker?: StepCircuitBreakerConfig;
  onFailure: OnFailureAction;
}

export interface StepConfig {
  // field_mapping
  mappingId?: string;
  direction?: 'request' | 'response';

  // apply_rules
  scope?: 'pre_rating' | 'post_rating';

  // format_transform
  formatDirection?: FormatDirection;

  // call_rating_engine / call_external_api
  systemCode?: string;

  // call_orchestrator
  orchestratorCode?: string;

  // publish_event
  topic?: string;
  eventType?: string;

  // enrich
  lookups?: Array<{
    sourceField: string;
    tableKey: string;
    targetField: string;
  }>;

  // shared
  implementationType?: ImplementationType;
  libraryName?: string;
  apiEndpoint?: string;
  apiMethod?: 'GET' | 'POST' | 'PUT';

  // condition (optional — skip step if not met)
  condition?: StepCondition;

  // resilience
  resilience?: StepResilienceConfig;
}

export interface OrchestratorStep {
  id: string;
  orchestratorId: string;
  stepOrder: number;
  stepType: OrchestratorStepType;
  name: string;
  config: StepConfig;
  isActive: boolean;
  createdAt: string;
}

export interface ProductOrchestrator {
  id: string;
  productLineCode: string;
  name: string;
  status: 'draft' | 'active' | 'inactive';
  steps: OrchestratorStep[];
  createdAt: string;
  updatedAt: string;
}

export type OrchestratorTemplate = 'xml-target' | 'json-target' | 'custom';
