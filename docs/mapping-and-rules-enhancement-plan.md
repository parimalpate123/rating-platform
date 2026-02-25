# Mapping & Rules Enhancement Plan — End-to-End Orchestration Execution

## Problem Statement

The orchestration flow (visible in the UI for products like IMCE) defines a 9-step pipeline:

```
1. Validate Request
2. Map Request Fields      ← field_mapping (request direction)
3. Pre-Rating Rules        ← apply_rules (pre_rating)
4. JSON to XML             ← format_transform (json_to_xml)
5. Call CGI Ratabase       ← call_rating_engine
6. XML to JSON             ← format_transform (xml_to_json)
7. Map Response Fields     ← field_mapping (response direction)
8. Post-Rating Rules       ← apply_rules (post_rating)
9. Publish Event to Kafka  ← publish_event
```

**Current state:** When this flow executes, Steps 2 and 7 (field mapping) only perform direct field copies — none of the 17 transformation types (multiply, divide, date, expression, lookup, etc.) are applied. Steps 3 and 8 (rules) are functional but missing some operators and actions. The data flowing through `context.working` doesn't reflect the configured transformations, so downstream steps (JSON→XML, Call Engine) receive incomplete/untransformed data.

**Goal:** Make every step in the orchestration pipeline fully functional so that `context.working` is correctly transformed at each stage, and the final API response reflects the complete chain of transformations.

---

## Current State Assessment

### Field Mapping Handler (`orchestrators/core-rating/src/handlers/field-mapping.handler.ts`)

| Capability | Status | Notes |
|---|---|---|
| Direct field copy | ✅ Working | `getNestedValue()` → `setNestedValue()` |
| Default value fallback | ✅ Working | Uses `defaultValue` from field entity |
| Multiply transform | ❌ Not implemented | `transformConfig.factor` ignored |
| Divide transform | ❌ Not implemented | `transformConfig.divisor` ignored |
| Round transform | ❌ Not implemented | `transformConfig.decimals` ignored |
| Per-unit transform | ❌ Not implemented | `transformConfig.unitSize` ignored |
| Date formatting | ❌ Not implemented | `transformConfig.format` ignored |
| Number formatting | ❌ Not implemented | |
| Expression evaluation | ❌ Not implemented | `transformConfig.expression` ignored |
| Lookup table | ❌ Not implemented | `transformConfig.tableKey` ignored |
| Concatenate | ❌ Not implemented | |
| Split | ❌ Not implemented | |
| Boolean coercion | ❌ Not implemented | |
| Conditional transform | ❌ Not implemented | |
| Aggregate | ❌ Not implemented | |
| Constant | ❌ Not implemented | |
| Custom (JS expression) | ❌ Not implemented | |
| Scope filtering | ❌ Not implemented | Mapping not filtered by scope tags |
| Skip field logic | ❌ Not implemented | `transformConfig.skipMapping` ignored |
| Required field validation | ❌ Not implemented | `isRequired` not enforced |

### Rules Service (`services/rules-service/src/rules/rules.service.ts`)

| Capability | Status | Notes |
|---|---|---|
| 14 condition operators | ✅ Working | ==, !=, >, >=, <, <=, contains, in, etc. |
| `between` operator | ❌ Not implemented | Defined in contracts only |
| `regex` operator | ❌ Not implemented | Defined in contracts only |
| 9 action types | ✅ Working | set, add, subtract, multiply, divide, surcharge, discount, reject, set_premium |
| `flag` action | ❌ Not implemented | Defined in contracts only |
| `skip_step` action | ❌ Not implemented | Defined in contracts only |
| Scope filtering | ✅ Working | AND between types, OR within type |
| AI rule generation | ✅ Working | Bedrock + heuristic fallback |
| Rule dry-run/testing | ❌ Not implemented | |
| Rule versioning | ❌ Not implemented | |
| Conflict detection | ❌ Not implemented | |

### Transform Service (`services/transform-service/src/transform/transform.service.ts`)

| Capability | Status | Notes |
|---|---|---|
| JSON → XML | ✅ Working | Via fast-xml-parser |
| XML → JSON | ✅ Working | Via fast-xml-parser |
| JSON → SOAP | ✅ Working | Wraps in SOAP envelope |
| SOAP → JSON | ✅ Working | Unwraps SOAP envelope |
| Field-level transforms | ❌ Not here | Lives in field-mapping handler |

---

## Phase 1: Field-Level Transformation Engine

**Goal:** Make the FieldMappingHandler apply all 17 transformation types when copying fields.

### 1a. Create Transformation Executor

**File (new):** `orchestrators/core-rating/src/handlers/transforms/transform-executor.ts`

This is the core engine that applies a transformation to a single field value based on its `transformationType` and `transformConfig`.

```typescript
export interface TransformContext {
  value: unknown;                          // Source field value
  transformationType: string;              // e.g., 'multiply', 'date', 'expression'
  transformConfig: Record<string, any>;    // e.g., { factor: 1.5 }
  defaultValue?: string;                   // Fallback if source is null/undefined
  sourcePath: string;                      // For error reporting
  targetPath: string;                      // For error reporting
  fullContext?: Record<string, unknown>;    // Entire working state (for expression/conditional)
}

export interface TransformResult {
  value: unknown;
  applied: boolean;     // Whether transformation was actually applied
  error?: string;       // Error message if transform failed
}

export function executeTransform(ctx: TransformContext): TransformResult;
```

**Transformation implementations:**

| Type | Logic | Config Fields |
|---|---|---|
| `direct` | Pass-through, no transformation | — |
| `constant` | Return `transformConfig.constantValue` regardless of source | `constantValue` |
| `multiply` | `value * transformConfig.factor` | `factor: number` |
| `divide` | `value / transformConfig.divisor` (guard ÷0) | `divisor: number` |
| `round` | `Math.round(value * 10^decimals) / 10^decimals` | `decimals: number` |
| `per_unit` | `value / transformConfig.unitSize` | `unitSize: number` |
| `number_format` | Format number with locale/precision | `locale?: string, precision?: number` |
| `date` | Parse input date → format output | `inputFormat?: string, format: string` (YYYY-MM-DD, MM/DD/YYYY, timestamp, epoch, ISO) |
| `boolean` | Coerce to boolean: truthy/falsy, "yes"/"true"/"1" → true | `trueValues?: string[]` |
| `concatenate` | Join multiple fields with separator | `fields: string[], separator: string` |
| `split` | Split string into array | `delimiter: string, index?: number` |
| `expression` | Evaluate JS expression with `value`, `working` in scope | `expression: string` |
| `conditional` | If condition met → transform A, else → transform B | `condition: { field, operator, value }, thenValue, elseValue` |
| `lookup` | Look up value from a decision/lookup table | `tableKey: string, matchField?: string` |
| `aggregate` | Sum/avg/min/max over an array field | `operation: 'sum'\|'avg'\|'min'\|'max', arrayPath: string, fieldPath?: string` |
| `custom` | Execute a full JS function body (sandboxed) | `functionBody: string` |

**Expression/Custom sandboxing:** Use `node:vm` (same pattern as `execution.service.ts` condition expressions) with 100ms timeout, only `value`, `working`, and `request` in scope.

**Error handling per transform:**
- If transform fails, log warning and fall back to raw value (do not halt execution)
- Track `{ transformationType, error }` in step output for debugging

### 1b. Integrate Executor into FieldMappingHandler

**File:** `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

**Current logic (simplified):**
```typescript
for (field of fieldMappings) {
  const value = getNestedValue(sourceData, field.sourcePath);
  if (value !== undefined) {
    setNestedValue(target, field.targetPath, value);
  } else if (field.defaultValue) {
    setNestedValue(target, field.targetPath, field.defaultValue);
  }
}
```

**Enhanced logic:**
```typescript
for (field of fieldMappings) {
  // 1. Check skip logic
  if (field.transformConfig?.skipMapping) {
    if (field.transformConfig.skipBehavior === 'use_default' && field.defaultValue) {
      setNestedValue(target, field.targetPath, field.defaultValue);
    }
    continue;
  }

  // 2. Extract source value
  let value = getNestedValue(sourceData, field.sourcePath);

  // 3. Apply default if missing
  if (value === undefined || value === null) {
    if (field.isRequired) {
      errors.push({ field: field.sourcePath, error: 'Required field missing' });
      continue;
    }
    if (field.defaultValue !== undefined && field.defaultValue !== null) {
      value = field.defaultValue;
    } else {
      continue; // No value, no default → skip
    }
  }

  // 4. Apply transformation
  const result = executeTransform({
    value,
    transformationType: field.transformationType,
    transformConfig: field.transformConfig || {},
    defaultValue: field.defaultValue,
    sourcePath: field.sourcePath,
    targetPath: field.targetPath,
    fullContext: context.working,
  });

  if (result.error) {
    transformErrors.push({ field: field.sourcePath, type: field.transformationType, error: result.error });
  }

  // 5. Set transformed value
  setNestedValue(target, field.targetPath, result.value);
}
```

### 1c. Add Required Field Validation

When `isRequired: true` on a field mapping and the source value is missing (no default), the handler should:
1. Add the field to an `errors` array in the step output
2. Still continue processing remaining fields (don't halt)
3. Set step status to `'completed'` with a `warnings` array (not `'failed'`)

### 1d. Add Scope Filtering for Mappings

**File:** `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

When resolving which mapping to use (if `config.mappingId` is not specified), the handler currently picks the first mapping matching direction + productLineCode. Enhance to:

1. Fetch scope tags for candidate mappings from product-config: `GET /mappings/:id/scope-tags` (new endpoint needed — see Phase 3a)
2. Filter mappings by scope match (same AND/OR logic as rules-service):
   - Within a scope type (e.g., multiple `state` tags): OR
   - Between scope types: AND
3. If multiple mappings match after scope filtering, pick the one with the most specific scope (most tags matched)
4. If no scoped mapping matches, fall back to unscoped mapping

**New endpoint needed in product-config:**
- `GET /api/v1/mappings/:id/scope-tags` — return scope tags for a mapping
- `POST /api/v1/mappings/:id/scope-tags` — add scope tag
- `DELETE /api/v1/mappings/:id/scope-tags/:tagId` — delete scope tag

These follow the exact same pattern as `rules-service` scope tag endpoints, using the `entity_scope_tags` table with `entity_type='mapping'`.

### Phase 1 Verification

- `npx nx typecheck core-rating` passes
- `npx nx build core-rating` passes
- Unit tests for each transformation type in `transform-executor.spec.ts`
- Integration: Execute IMCE `/rate` flow with a mapping that has `multiply` fields → verify `context.working` contains multiplied values before JSON→XML step

---

## Phase 2: Rules Engine Enhancements

**Goal:** Add missing operators, actions, and testing capabilities to the rules engine.

### 2a. Add `between` Operator

**File:** `services/rules-service/src/rules/rules.service.ts`

Add to `evaluateCondition()`:

```typescript
case 'between': {
  const [min, max] = Array.isArray(conditionValue) ? conditionValue : [null, null];
  const numVal = Number(fieldValue);
  return !isNaN(numVal) && numVal >= Number(min) && numVal <= Number(max);
}
```

**Condition value format:** `[min, max]` as a JSONB array.

**Frontend:** Add `between` to operator dropdown in `RulesTab.tsx`. Show two input fields (min, max) when selected.

### 2b. Add `regex` Operator

**File:** `services/rules-service/src/rules/rules.service.ts`

```typescript
case 'regex': {
  try {
    const pattern = new RegExp(String(conditionValue));
    return pattern.test(String(fieldValue));
  } catch {
    return false; // Invalid regex → condition not met
  }
}
```

**Frontend:** Add `regex` to operator dropdown. Show text input with placeholder "e.g., ^[A-Z]{2}\\d{4}$".

### 2c. Add `flag` Action

**File:** `services/rules-service/src/rules/rules.service.ts`

Add to `applyAction()`:

```typescript
case 'flag': {
  // Add a flag marker to the context — downstream steps can check flags
  const flags = (modifiedFields['_flags'] as string[]) || [];
  flags.push(String(action.value));
  modifiedFields['_flags'] = flags;
  break;
}
```

**Use case:** Flag a submission for manual review without rejecting it. Downstream handlers/UI can check `context.working._flags`.

### 2d. Add `skip_step` Action

**File:** `services/rules-service/src/rules/rules.service.ts`

```typescript
case 'skip_step': {
  // Mark a step to be skipped — execution engine checks this
  const skippedSteps = (modifiedFields['_skipSteps'] as string[]) || [];
  skippedSteps.push(String(action.value));  // value = step name or step type
  modifiedFields['_skipSteps'] = skippedSteps;
  break;
}
```

**Requires execution engine change** (`execution.service.ts`): Before executing a step, check if `context.working._skipSteps` includes the current step's `name` or `stepType`. If so, skip with status `'skipped'` and reason `'Skipped by rule'`.

### 2e. Add `copy_field` Action

**File:** `services/rules-service/src/rules/rules.service.ts`

```typescript
case 'copy_field': {
  // Copy value from one field to another
  const sourceField = String(action.value);
  const sourceValue = sourceField.split('.').reduce((obj: any, key) => obj?.[key], context);
  if (sourceValue !== undefined) {
    modifiedFields[action.targetField] = sourceValue;
  }
  break;
}
```

**Use case:** Copy `insured.state` to `rating.territory` based on a condition.

### 2f. Add `append` Action

**File:** `services/rules-service/src/rules/rules.service.ts`

```typescript
case 'append': {
  // Append value to an array field
  const existing = modifiedFields[action.targetField] ??
    action.targetField.split('.').reduce((obj: any, key) => obj?.[key], context);
  const arr = Array.isArray(existing) ? [...existing] : existing ? [existing] : [];
  arr.push(action.value);
  modifiedFields[action.targetField] = arr;
  break;
}
```

**Use case:** Append endorsement codes, coverage flags, or validation messages to an array.

### 2g. Defensive Improvements

**Division by zero:** In `divide` action, check for zero and skip with warning:
```typescript
case 'divide': {
  const divisor = Number(action.value);
  if (divisor === 0) {
    this.logger.warn(`Division by zero in rule action for ${action.targetField}`);
    break;
  }
  // ... existing logic
}
```

**Type validation:** Before arithmetic actions, validate that both operands are numeric:
```typescript
const numCurrent = Number(currentValue);
const numAction = Number(action.value);
if (isNaN(numCurrent) || isNaN(numAction)) {
  this.logger.warn(`Non-numeric value in ${action.actionType} for ${action.targetField}`);
  break;
}
```

### 2h. Update Contracts Package

**File:** `packages/contracts/src/lib/rules.ts`

Add new operators and actions to the type definitions:
```typescript
export type RuleOperator =
  | 'equals' | 'not_equals' | 'greater_than' | 'less_than'
  | 'greater_or_equal' | 'less_or_equal'
  | 'contains' | 'not_contains'
  | 'in' | 'not_in'
  | 'between'           // NEW
  | 'regex'             // NEW
  | 'is_null' | 'is_not_null';

export type RuleActionType =
  | 'set_value' | 'multiply' | 'add' | 'subtract'
  | 'divide' | 'surcharge' | 'discount'
  | 'reject' | 'set_premium'
  | 'flag'              // NEW
  | 'skip_step'         // NEW
  | 'copy_field'        // NEW
  | 'append';           // NEW
```

### 2i. Update Frontend for New Operators & Actions

**File:** `frontend/rating-workspace/src/components/tabs/RulesTab.tsx`

1. Add `between` to operator options — render two value inputs (min/max) when selected
2. Add `regex` to operator options — show regex input with visual validation
3. Add `flag`, `skip_step`, `copy_field`, `append` to action type options
4. For `flag`: value input = flag name (e.g., "manual_review", "high_risk")
5. For `skip_step`: value input = step name dropdown (fetched from orchestrator steps)
6. For `copy_field`: value input = source field path
7. For `append`: value input = value to append

**File:** `frontend/rating-workspace/src/api/rules.ts`

Update TypeScript types to include new operators and actions.

### Phase 2 Verification

- `npx nx typecheck rules-service` passes
- `npx nx build rules-service` passes
- Unit tests for `between`, `regex` operators
- Unit tests for `flag`, `skip_step`, `copy_field`, `append` actions
- Unit tests for division-by-zero and type validation guards
- Integration: Create a rule with `between` condition and `flag` action → evaluate → verify `_flags` in response

---

## Phase 3: Product-Config Enhancements (Supporting Infrastructure)

### 3a. Scope Tags for Mappings (Product-Config)

**File:** `services/product-config/src/mappings/mappings.controller.ts`

Add three new endpoints mirroring the rules-service scope tag pattern:

```
GET    /api/v1/mappings/:id/scope-tags
POST   /api/v1/mappings/:id/scope-tags     { scopeType, scopeValue }
DELETE /api/v1/mappings/:id/scope-tags/:tagId
```

**File:** `services/product-config/src/mappings/mappings.service.ts`

Add methods:
- `listScopeTags(mappingId)` — query `entity_scope_tags` where `entity_type='mapping'` and `entity_id=mappingId`
- `addScopeTag(mappingId, scopeType, scopeValue)` — insert with uniqueness check
- `deleteScopeTag(mappingId, tagId)` — delete with parent validation

**Database:** No migration needed — `entity_scope_tags` table already supports `entity_type='mapping'`.

**Frontend:** Add scope tag management UI to `MappingAccordion` component (same pattern as `RulesTab` scope tags).

### 3b. Mapping Activation Workflow

**File:** `services/product-config/src/mappings/mappings.controller.ts`

Add endpoint:
```
POST /api/v1/mappings/:id/activate
```

Changes mapping status from `draft` → `active`. Only active mappings should be picked up by the FieldMappingHandler when `config.mappingId` is not specified.

**File:** `services/product-config/src/mappings/mappings.service.ts`

```typescript
async activateMapping(id: string): Promise<MappingEntity> {
  const mapping = await this.findMappingById(id);
  mapping.status = 'active';
  return this.mappingRepo.save(mapping);
}
```

### 3c. Bulk Field Operations

**File:** `services/product-config/src/mappings/mappings.controller.ts`

Add endpoints:
```
PUT    /api/v1/mappings/:id/fields/reorder    { fieldIds: string[] }
DELETE /api/v1/mappings/:id/fields/bulk        { fieldIds: string[] }
PUT    /api/v1/mappings/:id/fields/bulk        { fields: FieldMapping[] }
```

**Use case:** Reorder fields by drag-and-drop in the UI, bulk delete/update.

### 3d. Mapping Clone

**File:** `services/product-config/src/mappings/mappings.controller.ts`

```
POST /api/v1/mappings/:id/clone    { name?: string, productLineCode?: string }
```

Deep-copies a mapping and all its field mappings to a new mapping. Useful for creating product variants.

---

## Phase 4: Lookup / Decision Table Integration

**Goal:** Make the `lookup` transformation type functional by connecting to the decision tables system.

### 4a. Decision Table Service

The platform already has a "Decision Tables" section in the UI sidebar. This phase connects it to the mapping transformation engine.

**Lookup flow:**
1. Field mapping has `transformationType: 'lookup'` with `transformConfig: { tableKey: 'territory-factors' }`
2. Transform executor calls decision table service: `GET /api/v1/decision-tables/{tableKey}/lookup?value={sourceValue}`
3. Decision table returns the matched output value
4. Transform executor uses that value as the field's transformed value

**Decision table structure:**
```json
{
  "key": "territory-factors",
  "name": "Territory Rating Factors",
  "columns": [
    { "name": "state", "type": "input" },
    { "name": "factor", "type": "output" }
  ],
  "rows": [
    { "state": "NY", "factor": 1.35 },
    { "state": "CA", "factor": 1.25 },
    { "state": "TX", "factor": 1.10 }
  ]
}
```

### 4b. Multi-Column Lookup

For complex lookups involving multiple input columns:

```json
{
  "transformationType": "lookup",
  "transformConfig": {
    "tableKey": "class-code-factors",
    "matchFields": {
      "state": "policy.state",
      "classCode": "coverage.classCode"
    },
    "outputField": "factor"
  }
}
```

The executor sends all match fields to the decision table service, which finds the row matching all inputs.

---

## Phase 5: Execution Engine Integration (skip_step + working visibility)

**Goal:** Wire the rules engine's `skip_step` action into the execution loop, and ensure `context.working` changes are visible at every step.

### 5a. Skip Step Support in Execution Engine

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

Before executing each step, check for skip directives from rules:

```typescript
// In the main execution loop, after condition checks:
const skipSteps = (context.working as any)?._skipSteps as string[] | undefined;
if (skipSteps?.includes(step.name) || skipSteps?.includes(step.stepType)) {
  this.logger.log(
    `Skipping step ${step.stepOrder}: ${step.name} — skipped by rule action`,
    request.correlationId,
  );
  stepResults.push({
    stepId: step.id,
    stepType: step.stepType,
    stepName: step.name,
    status: 'skipped',
    durationMs: 0,
  });
  continue;
}
```

### 5b. Working Snapshot in Step Results

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

Optionally capture a snapshot of `context.working` after each step for debugging:

```typescript
stepResults.push({
  stepId: step.id,
  stepType: step.stepType,
  stepName: step.name,
  status: result.status || 'completed',
  durationMs: stepDuration,
  output: result.output,
  workingSnapshot: context.working,  // NEW — only in debug mode
});
```

Control via step config: `config.captureWorkingSnapshot: true` or a global debug flag.

---

## Phase 6: Rule Dry-Run / Testing Endpoint

**Goal:** Allow users to test rules against sample data without creating a transaction.

### 6a. Dry-Run Endpoint

**File:** `services/rules-service/src/rules/rules.controller.ts`

```
POST /api/v1/rules/dry-run
```

**Request:**
```json
{
  "productLineCode": "IMCE",
  "scope": { "state": "NY", "coverage": "BOP" },
  "phase": "pre_rating",
  "context": {
    "policy": { "state": "NY" },
    "building": { "yearBuilt": 1985 },
    "premium": { "base": 10000 }
  }
}
```

**Response:**
```json
{
  "rulesEvaluated": 5,
  "rulesApplied": 2,
  "appliedRules": [
    {
      "ruleId": "uuid",
      "ruleName": "NY Building Age Surcharge",
      "conditionsMet": true,
      "conditionsDetail": [
        { "field": "building.yearBuilt", "operator": "<", "value": 1990, "actual": 1985, "result": true }
      ],
      "actionsApplied": [
        { "actionType": "surcharge", "targetField": "premium.base", "value": 0.15, "before": 10000, "after": 11500 }
      ]
    }
  ],
  "skippedRules": [
    { "ruleId": "uuid", "ruleName": "CA Fire Zone", "reason": "Scope mismatch (state=CA, request=NY)" }
  ],
  "beforeState": { "premium": { "base": 10000 } },
  "afterState": { "premium": { "base": 11500 } },
  "modifiedFields": { "premium.base": 11500 },
  "durationMs": 12
}
```

**Key difference from `evaluate`:** Returns full condition evaluation detail (which conditions passed/failed) and before/after values for each action. Does not create any transaction records.

### 6b. Single Rule Test

```
POST /api/v1/rules/:id/test
```

Same as dry-run but evaluates only the specified rule (ignoring priority/other rules). Useful for testing a single rule in isolation.

### 6c. Frontend Test Panel

**File:** `frontend/rating-workspace/src/components/tabs/RulesTab.tsx`

Add a "Test Rule" button to each `RuleCard` that opens a modal:
1. JSON editor for sample context data
2. Scope selector (state, coverage, transaction type)
3. "Run Test" button → calls `/rules/:id/test`
4. Results panel showing condition evaluation, actions applied, before/after

Also add a "Test All Rules" button at the tab level → calls `/rules/dry-run` with the full product context.

---

## Phase 7: Mapping Preview / Test Execution

**Goal:** Allow users to test a mapping against sample data before activating it.

### 7a. Mapping Test Endpoint

**File:** `services/product-config/src/mappings/mappings.controller.ts` (or a new endpoint in core-rating)

```
POST /api/v1/mappings/:id/test
```

**Request:**
```json
{
  "sampleData": {
    "quoteNumber": "Q-12345",
    "insured": { "name": "Acme Corp", "state": "NY" },
    "premium": { "base": 50000 },
    "effectiveDate": "2026-03-01"
  }
}
```

**Response:**
```json
{
  "mappingId": "uuid",
  "mappingName": "IMCE Request Mapping",
  "direction": "request",
  "fieldResults": [
    {
      "sourcePath": "quoteNumber",
      "targetPath": "policy.quoteId",
      "transformationType": "direct",
      "sourceValue": "Q-12345",
      "transformedValue": "Q-12345",
      "applied": true
    },
    {
      "sourcePath": "premium.base",
      "targetPath": "rating.basePremium",
      "transformationType": "multiply",
      "transformConfig": { "factor": 1.15 },
      "sourceValue": 50000,
      "transformedValue": 57500,
      "applied": true
    },
    {
      "sourcePath": "effectiveDate",
      "targetPath": "policy.effectiveDate",
      "transformationType": "date",
      "transformConfig": { "format": "MM/DD/YYYY" },
      "sourceValue": "2026-03-01",
      "transformedValue": "03/01/2026",
      "applied": true
    }
  ],
  "outputData": {
    "policy": { "quoteId": "Q-12345", "effectiveDate": "03/01/2026" },
    "rating": { "basePremium": 57500 }
  },
  "errors": [],
  "durationMs": 5
}
```

### 7b. Frontend Mapping Preview

**File:** `frontend/rating-workspace/src/components/tabs/MappingsTab.tsx`

Add a "Test Mapping" button to each `MappingAccordion`:
1. JSON editor for sample input data (with option to load from last transaction)
2. "Run Test" button → calls `/mappings/:id/test`
3. Side-by-side view: Input (left) → Output (right) with field-level highlighting
4. Each field shows: source value → transformation → result value
5. Errors/warnings highlighted in red/yellow

---

## Phase 8: End-to-End Orchestration Testing

**Goal:** Provide a "Test Rating" capability that runs the full orchestration pipeline with sample data and shows step-by-step results.

This connects to the existing "Test Rating" item visible in the sidebar under MONITORING.

### 8a. Test Rating Endpoint

Uses the existing `POST /api/v1/rate/{productCode}` endpoint (from the Live Orchestration API plan) but with a `dryRun` flag:

```json
POST /api/v1/IMCE/rate
{
  "payload": { ... },
  "scope": { "state": "NY", "coverage": "BOP" },
  "dryRun": true
}
```

When `dryRun: true`:
- Execute the full pipeline
- Do NOT create transaction records in status-service
- Do NOT call external rating engines (use mock responses)
- DO return full step-by-step results with `context.working` snapshots

### 8b. Frontend Test Rating Page

The "Test Rating" page should show:
1. Product selector + flow selector (e.g., `/rate`, `/init-rate`)
2. JSON editor for payload
3. Scope inputs (state, coverage, transaction type)
4. "Execute Test" button
5. Step-by-step timeline visualization:
   - Each step shows: name, type, duration, status (pass/fail/skip)
   - Expandable to show `context.working` state after that step
   - Diff view: what changed in `working` from previous step
6. Final output panel showing the complete response

---

## Files Summary

| Phase | File | Action |
|---|---|---|
| 1a | `orchestrators/core-rating/src/handlers/transforms/transform-executor.ts` | Create |
| 1a | `orchestrators/core-rating/src/handlers/transforms/transform-executor.spec.ts` | Create |
| 1b | `orchestrators/core-rating/src/handlers/field-mapping.handler.ts` | Edit |
| 1d | `services/product-config/src/mappings/mappings.controller.ts` | Edit (scope tag endpoints) |
| 1d | `services/product-config/src/mappings/mappings.service.ts` | Edit (scope tag methods) |
| 2a-f | `services/rules-service/src/rules/rules.service.ts` | Edit (operators + actions) |
| 2h | `packages/contracts/src/lib/rules.ts` | Edit (type definitions) |
| 2i | `frontend/rating-workspace/src/components/tabs/RulesTab.tsx` | Edit (new operator/action UI) |
| 2i | `frontend/rating-workspace/src/api/rules.ts` | Edit (types) |
| 3b | `services/product-config/src/mappings/mappings.controller.ts` | Edit (activate endpoint) |
| 3c | `services/product-config/src/mappings/mappings.controller.ts` | Edit (bulk operations) |
| 3d | `services/product-config/src/mappings/mappings.controller.ts` | Edit (clone) |
| 5a | `orchestrators/core-rating/src/execution/execution.service.ts` | Edit (skip_step) |
| 6a | `services/rules-service/src/rules/rules.controller.ts` | Edit (dry-run) |
| 6a | `services/rules-service/src/rules/rules.service.ts` | Edit (dry-run logic) |
| 6c | `frontend/rating-workspace/src/components/tabs/RulesTab.tsx` | Edit (test panel) |
| 7a | `services/product-config/src/mappings/mappings.controller.ts` | Edit (test endpoint) |
| 7b | `frontend/rating-workspace/src/components/tabs/MappingsTab.tsx` | Edit (test panel) |

---

## Implementation Priority

| Priority | Phase | Description | Effort |
|---|---|---|---|
| **P0 — Critical** | 1a, 1b | Transform executor + handler integration | Medium |
| **P0 — Critical** | 1c | Required field validation | Small |
| **P1 — High** | 2a, 2b | Between + regex operators | Small |
| **P1 — High** | 2c, 2d | Flag + skip_step actions | Small |
| **P1 — High** | 5a | Execution engine skip_step support | Small |
| **P1 — High** | 3b | Mapping activation workflow | Small |
| **P2 — Medium** | 1d | Scope filtering for mappings | Medium |
| **P2 — Medium** | 2e, 2f | copy_field + append actions | Small |
| **P2 — Medium** | 2g | Defensive improvements (÷0, type checks) | Small |
| **P2 — Medium** | 3a | Scope tag endpoints for mappings | Small |
| **P2 — Medium** | 6 | Rule dry-run/testing | Medium |
| **P2 — Medium** | 7 | Mapping test/preview | Medium |
| **P3 — Lower** | 3c, 3d | Bulk operations + clone | Small |
| **P3 — Lower** | 4 | Lookup/decision table integration | Medium |
| **P3 — Lower** | 5b | Working snapshots in step results | Small |
| **P3 — Lower** | 8 | Full end-to-end test rating page | Large |

---

## Dependency Graph

```
Phase 1a (Transform Executor)
    └──→ Phase 1b (Handler Integration)
            └──→ Phase 1c (Required Validation)
            └──→ Phase 1d (Scope Filtering) ←── Phase 3a (Scope Tag Endpoints)
            └──→ Phase 4 (Lookup Tables)
            └──→ Phase 7 (Mapping Test)

Phase 2a-f (Rules Enhancements)
    └──→ Phase 2g (Defensive Improvements)
    └──→ Phase 2d (skip_step) ──→ Phase 5a (Execution Engine)
    └──→ Phase 6 (Rule Dry-Run)

Phase 3b (Activation) — Independent
Phase 3c-d (Bulk/Clone) — Independent

Phase 8 (E2E Testing) ←── Phases 1, 2, 5, 6, 7
```

---

## Data Flow After All Enhancements

```
Request: POST /api/v1/IMCE/rate
{
  "payload": { "quoteNumber": "Q-123", "insured": { "state": "NY" }, "premium": { "base": 50000 } },
  "scope": { "state": "NY", "coverage": "BOP", "transactionType": "new_business" }
}

Step 1: Validate Request
  context.working = { quoteNumber: "Q-123", insured: { state: "NY" }, premium: { base: 50000 } }

Step 2: Map Request Fields (scope: state=NY, direction=request)
  Apply field mappings with transformations:
    quoteNumber → policy.quoteId (direct)
    premium.base → rating.basePremium (multiply × 1.15 territory factor)
    insured.state → address.stateCode (direct)
  context.working = { policy: { quoteId: "Q-123" }, rating: { basePremium: 57500 }, address: { stateCode: "NY" } }

Step 3: Pre-Rating Rules (scope: pre_rating, state=NY)
  Rule "NY Building Surcharge": condition building.yearBuilt < 1990 → surcharge 15%
  Rule "High Value Flag": condition rating.basePremium > 50000 → flag "high_value"
  context.working.rating.basePremium = 66125
  context.working._flags = ["high_value"]

Step 4: JSON to XML
  context.working = "<root><policy><quoteId>Q-123</quoteId>...</root>"

Step 5: Call CGI Ratabase
  Send XML → Receive XML response
  context.response = { premium: { final: 72000 }, ... }

Step 6: XML to JSON
  context.working = { policy: { quoteId: "Q-123" }, premium: { final: 72000 } }

Step 7: Map Response Fields (scope: state=NY, direction=response)
  Apply response field mappings:
    premium.final → quote.totalPremium (direct)
    policy.quoteId → quote.referenceNumber (direct)
  context.working = { quote: { totalPremium: 72000, referenceNumber: "Q-123" } }

Step 8: Post-Rating Rules (scope: post_rating)
  Rule "Minimum Premium Floor": condition quote.totalPremium < 500 → set 500
  No change (72000 > 500)

Step 9: Publish Event to Kafka
  Publish rating.completed event

Response:
{
  "transactionId": "uuid",
  "status": "completed",
  "data": { "quote": { "totalPremium": 72000, "referenceNumber": "Q-123" }, "_flags": ["high_value"] },
  "response": { "premium": { "final": 72000 } },
  "stepResults": [ ... 9 step entries ... ],
  "totalDurationMs": 342
}
```
