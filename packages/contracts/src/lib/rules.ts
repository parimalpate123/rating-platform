// ─── Rules Engine Contracts ─────────────────────────────────────────────────
// Rules are evaluated by the rules-service and applied during orchestration.

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'between'
  | 'regex'
  | 'is_null'
  | 'is_not_null';

export type RuleActionType =
  | 'set_value'
  | 'multiply'
  | 'add'
  | 'subtract'
  | 'divide'
  | 'surcharge'
  | 'discount'
  | 'set_premium'
  | 'reject'
  | 'flag'
  | 'skip_step'
  | 'copy_field'
  | 'append';

export interface RuleCondition {
  id: string;
  ruleId: string;
  field: string;
  operator: RuleOperator;
  value: unknown;
  logicalGroup?: number;
}

export interface RuleAction {
  id: string;
  ruleId: string;
  actionType: RuleActionType;
  targetField: string;
  value: unknown;
  sortOrder: number;
}

export interface Rule {
  id: string;
  name: string;
  productLineCode: string;
  description?: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleEvaluationRequest {
  correlationId: string;
  productLineCode: string;
  scope: {
    state?: string;
    coverage?: string;
    transactionType?: string;
  };
  phase: 'pre_rating' | 'post_rating';
  context: Record<string, unknown>;
}

export interface RuleEvaluationResult {
  rulesEvaluated: number;
  rulesApplied: number;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    actions: RuleAction[];
  }>;
  modifiedFields: Record<string, unknown>;
  durationMs: number;
}
