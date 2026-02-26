import { rulesService } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RuleOperator =
  | '==' | '!=' | '>' | '>=' | '<' | '<='
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  | 'is_empty' | 'is_not_empty'
  | 'between' | 'regex';

export type ActionType =
  | 'set' | 'set_value' | 'add' | 'increment'
  | 'subtract' | 'decrement' | 'multiply' | 'divide'
  | 'surcharge' | 'discount' | 'reject'
  | 'flag' | 'skip_step' | 'copy_field' | 'append';

export interface RuleCondition {
  id?: string;
  ruleId?: string;
  field: string;
  operator: RuleOperator;
  value: unknown;
  logicalGroup: number;
}

export interface RuleAction {
  id?: string;
  ruleId?: string;
  actionType: ActionType;
  targetField: string;
  value: unknown;
  sortOrder: number;
}

export interface Rule {
  id: string;
  name: string;
  description?: string;
  productLineCode: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface ScopeTag {
  id: string;
  entityType: string;
  entityId: string;
  scopeType: string;
  scopeValue: string;
  createdAt: string;
}

export interface GenerateAIResponse {
  rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'> & { conditions: RuleCondition[]; actions: RuleAction[] };
  confidence: number;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const rulesApi = {
  list: (productLineCode?: string) =>
    rulesService.get<Rule[]>('/rules', { params: productLineCode ? { productLineCode } : {} }).then((r) => r.data),

  get: (id: string) =>
    rulesService.get<Rule>(`/rules/${id}`).then((r) => r.data),

  create: (dto: Partial<Rule> & { conditions?: Partial<RuleCondition>[]; actions?: Partial<RuleAction>[] }) =>
    rulesService.post<Rule>('/rules', dto).then((r) => r.data),

  update: (id: string, dto: Partial<Rule> & { conditions?: Partial<RuleCondition>[]; actions?: Partial<RuleAction>[] }) =>
    rulesService.put<Rule>(`/rules/${id}`, dto).then((r) => r.data),

  delete: (id: string) =>
    rulesService.delete(`/rules/${id}`).then((r) => r.data),

  activate: (id: string) =>
    rulesService.post<Rule>(`/rules/${id}/activate`).then((r) => r.data),

  generateWithAI: (dto: { productLineCode: string; requirements: string }) =>
    rulesService.post<GenerateAIResponse>('rules/generate-ai', dto).then((r) => r.data),

  /** Generate a step run-condition expression from plain-English description (Bedrock or heuristic). */
  generateConditionExpression: (dto: {
    description: string
    stepName?: string
    stepType?: string
    productLineCode?: string
  }) =>
    rulesService.post<{ expression: string; source?: 'bedrock' | 'heuristic' }>('rules/generate-condition-expression', dto).then((r) => r.data),

  // Scope tags
  listScopeTags: (ruleId: string) =>
    rulesService.get<ScopeTag[]>(`/rules/${ruleId}/scope-tags`).then((r) => r.data),

  addScopeTag: (ruleId: string, dto: { scopeType: string; scopeValue: string }) =>
    rulesService.post<ScopeTag>(`/rules/${ruleId}/scope-tags`, dto).then((r) => r.data),

  deleteScopeTag: (ruleId: string, tagId: string) =>
    rulesService.delete(`/rules/${ruleId}/scope-tags/${tagId}`).then((r) => r.data),
};
