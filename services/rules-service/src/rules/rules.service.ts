import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RuleEntity } from '../entities/rule.entity';
import { RuleConditionEntity } from '../entities/rule-condition.entity';
import { RuleActionEntity } from '../entities/rule-action.entity';
import { ScopeTagEntity } from '../entities/scope-tag.entity';

export interface EvaluateRequest {
  productLineCode: string;
  scope?: {
    state?: string;
    coverage?: string;
    transactionType?: string;
  };
  phase: 'pre_rating' | 'post_rating';
  context: Record<string, any>;
}

export interface EvaluateResponse {
  rulesEvaluated: number;
  rulesApplied: number;
  appliedRules: string[];
  modifiedFields: Record<string, any>;
  durationMs: number;
}

@Injectable()
export class RulesService {
  private readonly logger = new Logger(RulesService.name);

  constructor(
    @InjectRepository(RuleEntity)
    private ruleRepo: Repository<RuleEntity>,
    @InjectRepository(RuleConditionEntity)
    private conditionRepo: Repository<RuleConditionEntity>,
    @InjectRepository(RuleActionEntity)
    private actionRepo: Repository<RuleActionEntity>,
    @InjectRepository(ScopeTagEntity)
    private scopeTagRepo: Repository<ScopeTagEntity>,
  ) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async findAll(productLineCode?: string): Promise<any[]> {
    const where: any = {};
    if (productLineCode) where.productLineCode = productLineCode;
    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    // Attach conditions + actions for each rule
    const result = [];
    for (const rule of rules) {
      const conditions = await this.conditionRepo.find({ where: { ruleId: rule.id } });
      const actions = await this.actionRepo.find({ where: { ruleId: rule.id }, order: { sortOrder: 'ASC' } });
      result.push({ ...rule, conditions, actions });
    }
    return result;
  }

  async findOne(id: string): Promise<any> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    const conditions = await this.conditionRepo.find({ where: { ruleId: id } });
    const actions = await this.actionRepo.find({ where: { ruleId: id }, order: { sortOrder: 'ASC' } });
    return { ...rule, conditions, actions };
  }

  async createWithRelations(
    data: Partial<RuleEntity>,
    conditions?: Partial<RuleConditionEntity>[],
    actions?: Partial<RuleActionEntity>[],
  ): Promise<any> {
    const rule = this.ruleRepo.create(data);
    const saved = await this.ruleRepo.save(rule);

    if (conditions?.length) {
      const entities = conditions.map((c, idx) =>
        this.conditionRepo.create({ ...c, ruleId: saved.id, logicalGroup: c.logicalGroup ?? 0 }),
      );
      await this.conditionRepo.save(entities);
    }

    if (actions?.length) {
      const entities = actions.map((a, idx) =>
        this.actionRepo.create({ ...a, ruleId: saved.id, sortOrder: a.sortOrder ?? idx }),
      );
      await this.actionRepo.save(entities);
    }

    return this.findOne(saved.id);
  }

  async updateWithRelations(
    id: string,
    data: Partial<RuleEntity>,
    conditions?: Partial<RuleConditionEntity>[],
    actions?: Partial<RuleActionEntity>[],
  ): Promise<any> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }

    Object.assign(rule, data);
    await this.ruleRepo.save(rule);

    // Replace conditions if provided
    if (conditions !== undefined) {
      await this.conditionRepo.delete({ ruleId: id });
      if (conditions.length) {
        const entities = conditions.map((c, idx) =>
          this.conditionRepo.create({ ...c, ruleId: id, logicalGroup: c.logicalGroup ?? 0 }),
        );
        await this.conditionRepo.save(entities);
      }
    }

    // Replace actions if provided
    if (actions !== undefined) {
      await this.actionRepo.delete({ ruleId: id });
      if (actions.length) {
        const entities = actions.map((a, idx) =>
          this.actionRepo.create({ ...a, ruleId: id, sortOrder: a.sortOrder ?? idx }),
        );
        await this.actionRepo.save(entities);
      }
    }

    return this.findOne(id);
  }

  async delete(id: string): Promise<void> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    await this.conditionRepo.delete({ ruleId: id });
    await this.actionRepo.delete({ ruleId: id });
    await this.scopeTagRepo.delete({ entityType: 'rule', entityId: id });
    await this.ruleRepo.remove(rule);
  }

  async activate(id: string): Promise<any> {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    rule.isActive = true;
    await this.ruleRepo.save(rule);
    return this.findOne(id);
  }

  // ── Scope Tags ──────────────────────────────────────────────────────────────

  async listScopeTags(ruleId: string): Promise<ScopeTagEntity[]> {
    return this.scopeTagRepo.find({
      where: { entityType: 'rule', entityId: ruleId },
    });
  }

  async addScopeTag(ruleId: string, scopeType: string, scopeValue: string): Promise<ScopeTagEntity> {
    const tag = this.scopeTagRepo.create({
      entityType: 'rule',
      entityId: ruleId,
      scopeType,
      scopeValue,
    });
    return this.scopeTagRepo.save(tag);
  }

  async deleteScopeTag(ruleId: string, tagId: string): Promise<void> {
    await this.scopeTagRepo.delete({ id: tagId, entityType: 'rule', entityId: ruleId });
  }

  // ── Evaluation Engine ───────────────────────────────────────────────────────

  async evaluate(request: EvaluateRequest): Promise<EvaluateResponse> {
    const start = Date.now();
    this.logger.log(`Evaluating rules for ${request.productLineCode}`);

    // 1. Load active rules
    const rules = await this.ruleRepo.find({
      where: { productLineCode: request.productLineCode, isActive: true },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    if (rules.length === 0) {
      return { rulesEvaluated: 0, rulesApplied: 0, appliedRules: [], modifiedFields: {}, durationMs: Date.now() - start };
    }

    // 2. Load scope tags for all rules in one query
    const ruleIds = rules.map((r) => r.id);
    const scopeTags = await this.scopeTagRepo.find({
      where: { entityType: 'rule', entityId: In(ruleIds) },
    });
    const scopeTagsByRule = new Map<string, ScopeTagEntity[]>();
    for (const tag of scopeTags) {
      if (!scopeTagsByRule.has(tag.entityId)) scopeTagsByRule.set(tag.entityId, []);
      scopeTagsByRule.get(tag.entityId)!.push(tag);
    }

    // 3. Filter rules by scope match
    const scopeMatchingRules = rules.filter((rule) => {
      const tags = scopeTagsByRule.get(rule.id) ?? [];
      if (tags.length === 0) return true; // No tags = applies to all

      // Group by scopeType — within same type: OR, between types: AND
      const tagsByType = new Map<string, string[]>();
      for (const tag of tags) {
        if (!tagsByType.has(tag.scopeType)) tagsByType.set(tag.scopeType, []);
        tagsByType.get(tag.scopeType)!.push(tag.scopeValue);
      }

      for (const [scopeType, values] of tagsByType) {
        const key = scopeType === 'transaction_type' ? 'transactionType' : scopeType;
        const requestValue = request.scope?.[key as keyof typeof request.scope];
        if (!requestValue || !values.includes(requestValue)) return false;
      }
      return true;
    });

    // 4. Evaluate each rule
    const modifiedFields: Record<string, any> = {};
    const appliedRules: string[] = [];

    for (const rule of scopeMatchingRules) {
      try {
        const conditions = await this.conditionRepo.find({ where: { ruleId: rule.id } });
        const matched = this.evaluateRuleConditions(conditions, request.context);

        if (matched) {
          const actions = await this.actionRepo.find({
            where: { ruleId: rule.id },
            order: { sortOrder: 'ASC' },
          });
          this.applyRuleActions(actions, modifiedFields, request.context);
          appliedRules.push(rule.name);
          this.logger.debug(`Rule '${rule.name}' matched and applied`);
        }
      } catch (error: any) {
        this.logger.error(`Error executing rule '${rule.name}': ${error.message}`);
      }
    }

    this.logger.log(`Evaluated ${scopeMatchingRules.length} rules, ${appliedRules.length} applied`);

    return {
      rulesEvaluated: scopeMatchingRules.length,
      rulesApplied: appliedRules.length,
      appliedRules,
      modifiedFields,
      durationMs: Date.now() - start,
    };
  }

  // ── Condition evaluation ────────────────────────────────────────────────────

  private evaluateRuleConditions(conditions: RuleConditionEntity[], context: Record<string, any>): boolean {
    if (!conditions || conditions.length === 0) return true;

    // Group by logicalGroup — AND within group, OR between groups
    const groups = new Map<number, RuleConditionEntity[]>();
    for (const c of conditions) {
      const group = c.logicalGroup ?? 0;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(c);
    }

    // At least one group must pass (OR between groups)
    for (const group of groups.values()) {
      if (group.every((c) => this.evaluateCondition(c, context))) return true;
    }
    return false;
  }

  private evaluateCondition(condition: RuleConditionEntity, context: Record<string, any>): boolean {
    const fieldValue = this.getNestedValue(context, condition.field);
    const expectedValue = condition.value;

    switch (condition.operator) {
      case 'equals':
      case '==':
        return fieldValue == expectedValue;
      case 'not_equals':
      case '!=':
        return fieldValue != expectedValue;
      case 'greater_than':
      case '>':
        return Number(fieldValue) > Number(expectedValue);
      case 'greater_than_or_equal':
      case '>=':
        return Number(fieldValue) >= Number(expectedValue);
      case 'less_than':
      case '<':
        return Number(fieldValue) < Number(expectedValue);
      case 'less_than_or_equal':
      case '<=':
        return Number(fieldValue) <= Number(expectedValue);
      case 'contains':
        return String(fieldValue).includes(String(expectedValue));
      case 'not_contains':
        return !String(fieldValue).includes(String(expectedValue));
      case 'starts_with':
        return String(fieldValue).startsWith(String(expectedValue));
      case 'ends_with':
        return String(fieldValue).endsWith(String(expectedValue));
      case 'in': {
        const list = Array.isArray(expectedValue) ? expectedValue : String(expectedValue).split(',').map((s: string) => s.trim());
        return list.includes(String(fieldValue));
      }
      case 'not_in': {
        const list = Array.isArray(expectedValue) ? expectedValue : String(expectedValue).split(',').map((s: string) => s.trim());
        return !list.includes(String(fieldValue));
      }
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      case 'is_not_null':
        return fieldValue !== null && fieldValue !== undefined;
      case 'is_empty':
        return fieldValue === null || fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      case 'is_not_empty':
        return fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      case 'between': {
        const range = Array.isArray(expectedValue) ? expectedValue : null;
        if (!range || range.length < 2) return false;
        const numVal = Number(fieldValue);
        return !isNaN(numVal) && numVal >= Number(range[0]) && numVal <= Number(range[1]);
      }
      case 'regex': {
        try {
          const pattern = new RegExp(String(expectedValue));
          return pattern.test(String(fieldValue));
        } catch {
          return false; // Invalid regex → condition not met
        }
      }
      default:
        this.logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  // ── Action application ──────────────────────────────────────────────────────

  private applyRuleActions(actions: RuleActionEntity[], modifiedFields: Record<string, any>, context: Record<string, any>): void {
    for (const action of actions) {
      try {
        this.applyAction(action, modifiedFields, context);
      } catch (error: any) {
        this.logger.error(`Error applying action ${action.actionType}: ${error.message}`);
      }
    }
  }

  private applyAction(action: RuleActionEntity, modifiedFields: Record<string, any>, context: Record<string, any>): void {
    const currentValue = modifiedFields[action.targetField] ?? this.getNestedValue(context, action.targetField) ?? 0;

    switch (action.actionType) {
      case 'set':
      case 'set_value':
      case 'set_field':
        modifiedFields[action.targetField] = action.value;
        break;

      case 'add':
      case 'increment':
      case 'add_to_field': {
        const numCurrent = Number(currentValue);
        const numAction = Number(action.value);
        if (isNaN(numCurrent) || isNaN(numAction)) {
          this.logger.warn(`Non-numeric value in add action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent + numAction;
        break;
      }

      case 'subtract':
      case 'decrement': {
        const numCurrent = Number(currentValue);
        const numAction = Number(action.value);
        if (isNaN(numCurrent) || isNaN(numAction)) {
          this.logger.warn(`Non-numeric value in subtract action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent - numAction;
        break;
      }

      case 'multiply':
      case 'multiply_field':
      case 'apply_factor': {
        const numCurrent = Number(currentValue);
        const numAction = Number(action.value);
        if (isNaN(numCurrent) || isNaN(numAction)) {
          this.logger.warn(`Non-numeric value in multiply action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent * numAction;
        break;
      }

      case 'divide': {
        const numCurrent = Number(currentValue);
        const divisor = Number(action.value);
        if (isNaN(numCurrent) || isNaN(divisor)) {
          this.logger.warn(`Non-numeric value in divide action for ${action.targetField}`);
          break;
        }
        if (divisor === 0) {
          this.logger.warn(`Division by zero in divide action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent / divisor;
        break;
      }

      case 'surcharge': {
        // Surcharge: multiply by (1 + value), e.g. value=0.20 means 20% surcharge
        const numCurrent = Number(currentValue);
        const numAction = Number(action.value);
        if (isNaN(numCurrent) || isNaN(numAction)) {
          this.logger.warn(`Non-numeric value in surcharge action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent * (1 + numAction);
        break;
      }

      case 'discount': {
        // Discount: multiply by (1 - value), e.g. value=0.15 means 15% discount
        const numCurrent = Number(currentValue);
        const numAction = Number(action.value);
        if (isNaN(numCurrent) || isNaN(numAction)) {
          this.logger.warn(`Non-numeric value in discount action for ${action.targetField}`);
          break;
        }
        modifiedFields[action.targetField] = numCurrent * (1 - numAction);
        break;
      }

      case 'set_premium':
        modifiedFields['premium'] = action.value;
        break;

      case 'reject':
        modifiedFields['_rejected'] = true;
        modifiedFields['_rejectReason'] = action.value;
        break;

      case 'flag': {
        // Add a flag marker — downstream steps can check context.working._flags
        const flags = (modifiedFields['_flags'] as string[]) || [];
        flags.push(String(action.value));
        modifiedFields['_flags'] = flags;
        break;
      }

      case 'skip_step': {
        // Mark a step to be skipped — execution engine checks _skipSteps
        const skippedSteps = (modifiedFields['_skipSteps'] as string[]) || [];
        skippedSteps.push(String(action.value));
        modifiedFields['_skipSteps'] = skippedSteps;
        break;
      }

      case 'copy_field': {
        // Copy value from source field path to targetField
        const sourceField = String(action.value);
        const sourceValue = this.getNestedValue(context, sourceField);
        if (sourceValue !== undefined) {
          modifiedFields[action.targetField] = sourceValue;
        }
        break;
      }

      case 'append': {
        // Append value to an array field
        const existing = modifiedFields[action.targetField] ?? this.getNestedValue(context, action.targetField);
        const arr = Array.isArray(existing) ? [...existing] : (existing != null ? [existing] : []);
        arr.push(action.value);
        modifiedFields[action.targetField] = arr;
        break;
      }

      default:
        this.logger.warn(`Unknown action type: ${action.actionType}`);
    }
  }

  // ── Dry-Run ─────────────────────────────────────────────────────────────────

  async dryRun(request: EvaluateRequest): Promise<DryRunResponse> {
    const start = Date.now();

    const rules = await this.ruleRepo.find({
      where: { productLineCode: request.productLineCode, isActive: true },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });

    const ruleIds = rules.map((r) => r.id);
    const scopeTags = ruleIds.length
      ? await this.scopeTagRepo.find({ where: { entityType: 'rule', entityId: In(ruleIds) } })
      : [];
    const scopeTagsByRule = new Map<string, ScopeTagEntity[]>();
    for (const tag of scopeTags) {
      if (!scopeTagsByRule.has(tag.entityId)) scopeTagsByRule.set(tag.entityId, []);
      scopeTagsByRule.get(tag.entityId)!.push(tag);
    }

    const scopeMatchingRules = rules.filter((rule) => {
      const tags = scopeTagsByRule.get(rule.id) ?? [];
      if (tags.length === 0) return true;
      const tagsByType = new Map<string, string[]>();
      for (const tag of tags) {
        if (!tagsByType.has(tag.scopeType)) tagsByType.set(tag.scopeType, []);
        tagsByType.get(tag.scopeType)!.push(tag.scopeValue);
      }
      for (const [scopeType, values] of tagsByType) {
        const key = scopeType === 'transaction_type' ? 'transactionType' : scopeType;
        const requestValue = request.scope?.[key as keyof typeof request.scope];
        if (!requestValue || !values.includes(requestValue)) return false;
      }
      return true;
    });

    const skippedRules: DryRunResponse['skippedRules'] = rules
      .filter((r) => !scopeMatchingRules.find((sr) => sr.id === r.id))
      .map((r) => ({ ruleId: r.id, ruleName: r.name, reason: 'Scope mismatch' }));

    const modifiedFields: Record<string, any> = {};
    const appliedRules: DryRunResponse['appliedRules'] = [];
    const beforeState = JSON.parse(JSON.stringify(request.context));

    for (const rule of scopeMatchingRules) {
      try {
        const conditions = await this.conditionRepo.find({ where: { ruleId: rule.id } });
        const conditionsDetail = conditions.map((c) => {
          const actual = this.getNestedValue(request.context, c.field);
          const result = this.evaluateCondition(c, request.context);
          return { field: c.field, operator: c.operator, value: c.value, actual, result };
        });

        const matched = this.evaluateRuleConditions(conditions, request.context);
        if (!matched) {
          skippedRules.push({ ruleId: rule.id, ruleName: rule.name, reason: 'Conditions not met' });
          continue;
        }

        const actions = await this.actionRepo.find({ where: { ruleId: rule.id }, order: { sortOrder: 'ASC' } });
        const actionsApplied: DryRunResponse['appliedRules'][0]['actionsApplied'] = [];

        for (const action of actions) {
          const before = modifiedFields[action.targetField]
            ?? this.getNestedValue(request.context, action.targetField);
          this.applyAction(action, modifiedFields, request.context);
          const after = modifiedFields[action.targetField];
          actionsApplied.push({ actionType: action.actionType, targetField: action.targetField, value: action.value, before, after });
        }

        appliedRules.push({ ruleId: rule.id, ruleName: rule.name, conditionsMet: true, conditionsDetail, actionsApplied });
      } catch (error: any) {
        this.logger.error(`Error in dry-run for rule '${rule.name}': ${error.message}`);
      }
    }

    return {
      rulesEvaluated: scopeMatchingRules.length,
      rulesApplied: appliedRules.length,
      appliedRules,
      skippedRules,
      beforeState,
      afterState: { ...request.context, ...modifiedFields },
      modifiedFields,
      durationMs: Date.now() - start,
    };
  }

  async testRule(ruleId: string, context: Record<string, any>, scope?: EvaluateRequest['scope']): Promise<DryRunResponse> {
    const rule = await this.findOne(ruleId);
    const start = Date.now();
    const modifiedFields: Record<string, any> = {};
    const beforeState = JSON.parse(JSON.stringify(context));

    const conditionsDetail = rule.conditions.map((c: any) => {
      const actual = this.getNestedValue(context, c.field);
      const result = this.evaluateCondition(c, context);
      return { field: c.field, operator: c.operator, value: c.value, actual, result };
    });
    const matched = this.evaluateRuleConditions(rule.conditions, context);
    const appliedRules: DryRunResponse['appliedRules'] = [];

    if (matched) {
      const actionsApplied: DryRunResponse['appliedRules'][0]['actionsApplied'] = [];
      for (const action of rule.actions) {
        const before = this.getNestedValue(context, action.targetField);
        this.applyAction(action, modifiedFields, context);
        const after = modifiedFields[action.targetField];
        actionsApplied.push({ actionType: action.actionType, targetField: action.targetField, value: action.value, before, after });
      }
      appliedRules.push({ ruleId: rule.id, ruleName: rule.name, conditionsMet: true, conditionsDetail, actionsApplied });
    }

    return {
      rulesEvaluated: 1,
      rulesApplied: matched ? 1 : 0,
      appliedRules,
      skippedRules: matched ? [] : [{ ruleId: rule.id, ruleName: rule.name, reason: 'Conditions not met' }],
      beforeState,
      afterState: { ...context, ...modifiedFields },
      modifiedFields,
      durationMs: Date.now() - start,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getNestedValue(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

}

export interface DryRunResponse {
  rulesEvaluated: number;
  rulesApplied: number;
  appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    conditionsMet: boolean;
    conditionsDetail: Array<{ field: string; operator: string; value: unknown; actual: unknown; result: boolean }>;
    actionsApplied: Array<{ actionType: string; targetField: string; value: unknown; before: unknown; after: unknown }>;
  }>;
  skippedRules: Array<{ ruleId: string; ruleName: string; reason: string }>;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  modifiedFields: Record<string, any>;
  durationMs: number;
}
