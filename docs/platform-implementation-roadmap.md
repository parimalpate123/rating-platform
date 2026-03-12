# InsuRateConnect — Platform Implementation Roadmap

## Mission

InsuRateConnect is an **Insurance Process Orchestration Fabric** — a configurable, step-based execution engine that routes, transforms, and enriches insurance data across external rating systems (Guidewire, CGI Ratabase, Earnix, Duck Creek, Salesforce). This roadmap builds the platform from a partially-wired execution engine into a fully functional, enterprise-grade system with conditional branching, visual flow editing, and CI-integrated configuration management.

---

## Guiding Principles

- **Phase 0 is non-negotiable.** The engine doesn't fully work without it. Branching conditions evaluate against `context.working` — if mappings and rules aren't correctly transforming that data, branch conditions evaluate stale/incomplete state. All subsequent phases depend on a correct execution engine.
- **Stable keys (Phase 0.6) unlock Config as Code.** Every entity gets a `configKey` slug. Without stable keys, config export/import must use UUIDs — which differ between environments and break portability.
- **Phases 1–4 are the core feature roadmap.** These deliver client-visible value: conditional branching from backend API through frontend editing.
- **Phases 5–6 are the deployment story.** Config as Code turns the platform from a dev-only tool into an enterprise-grade system with auditable, promotable configuration.
- **Phases 5+ are Post-MVP / Future.** The MVP is a fully working branching engine with a complete UI. Config as Code and the visual graph editor are the next tier.

---

## Rollback Strategy

### Git Strategy
- Each phase lives on its own feature branch (`feature/phase-0-engine-wiring`, `feature/conditional-branching`, etc.)
- `main` is never touched until each phase is fully tested
- Each phase is a separate PR; rollback = revert the PR

### Feature Flag
Add `ENABLE_BRANCH_STEPS` environment variable (default: `false` in production, `true` in dev/staging).

- **Backend OFF:** `line-rating` rejects `branch` step type creation; `core-rating` uses original linear `for` loop; `defaultNextStepId` ignored
- **Frontend OFF:** `branch` hidden from step type dropdown; no branch UI rendered

Deploy Phase 1 code to production with flag off; enable only when ready.

### Database Rollback
All migration changes are **additive only** (`ADD COLUMN`). Down migration scripts are provided alongside every up migration:

```sql
-- down: XXX_conditional_branching_down.sql
ALTER TABLE orchestrator_steps DROP COLUMN IF EXISTS default_next_step_id;
ALTER TABLE custom_flow_steps DROP COLUMN IF EXISTS default_next_step_id;
ALTER TABLE transaction_step_logs DROP COLUMN IF EXISTS branch_decision;
ALTER TABLE transactions DROP COLUMN IF EXISTS execution_path;
```

### Execution Engine Backward Compatibility
The graph traversal introduced in Phase 1.4 falls back to `stepOrder`-based linear execution when no `nextStepId` or `defaultNextStepId` is present. All existing orchestrators continue to work without modification. Verified by running the full GL product rating flow before and after the code change.

### Rollback Decision Checklist

| Situation | Action |
|---|---|
| Phase 1 tests fail | Revert PR; `main` unaffected |
| Phase 1 deployed but bugs found in prod | Set `ENABLE_BRANCH_STEPS=false`; flows immediately revert to linear |
| Schema issues after migration | Run down migration script; redeploy previous image |
| Phase 3+ UI issues | Feature flag hides all branch UI; backend unaffected |
| Full abort | Revert all feature PRs; run down migration — back to current state |

---

## Phase 0 — Rules & Mapping Engine Wiring + Stable Keys (~1 week)

**Goal:** Before building conditional branching, the core execution engine must be fully functional. This phase completes all P0/P1 items from `mapping-and-rules-enhancement-plan.md` and adds stable config keys to every entity.

> **Full implementation detail** for items 0.1–0.5 is in [`mapping-and-rules-enhancement-plan.md`](./mapping-and-rules-enhancement-plan.md). This section captures what must be done and why.

### 0.1 Field-Level Transformation Engine

**Files:**
- New: `orchestrators/core-rating/src/handlers/transforms/transform-executor.ts`
- New: `orchestrators/core-rating/src/handlers/transforms/transform-executor.spec.ts`
- Edit: `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

Currently **all 16 transformation types beyond direct copy are ignored** — multiply, divide, date format, expression, lookup, etc. `context.working` going into downstream steps (JSON→XML, Call Engine) contains raw/untransformed data.

Implement `executeTransform()` and wire it into `FieldMappingHandler`:

| Transform Type | Logic |
|---|---|
| `constant` | Return fixed `transformConfig.constantValue` |
| `multiply` | `value * transformConfig.factor` |
| `divide` | `value / transformConfig.divisor` (guard ÷0) |
| `round` | Round to `transformConfig.decimals` decimal places |
| `per_unit` | `value / transformConfig.unitSize` |
| `date` | Parse input → reformat output (`YYYY-MM-DD`, `MM/DD/YYYY`, epoch, ISO) |
| `boolean` | Coerce "yes"/"true"/"1" → `true` |
| `concatenate` | Join multiple fields with separator |
| `split` | Split string, optionally pick index |
| `expression` | Eval JS expression with `value` and `working` in scope (sandboxed via `node:vm`) |
| `conditional` | If condition met → value A, else → value B |
| `number_format` | Format with locale/precision |
| `aggregate` | sum/avg/min/max over array field |
| `custom` | Sandboxed JS function body |

Also wire in: required field validation (`isRequired: true`) and skip field logic (`transformConfig.skipMapping`). Error handling: failed transforms log a warning and fall back to raw value — execution is never halted.

### 0.2 Missing Rule Operators

**Files:**
- Edit: `services/rules-service/src/rules/rules.service.ts`
- Edit: `packages/contracts/src/lib/rules.ts`
- Edit: `frontend/rating-workspace/src/components/tabs/RulesTab.tsx`

Add two operators defined in contracts but not yet implemented:

- **`between`** — `fieldValue >= min && fieldValue <= max` (condition value is `[min, max]` JSONB array)
- **`regex`** — `new RegExp(conditionValue).test(fieldValue)` with try/catch guard

Frontend: add to operator dropdown; `between` shows two inputs (min/max); `regex` shows input with placeholder pattern.

### 0.3 Missing Rule Actions

**Files:**
- Edit: `services/rules-service/src/rules/rules.service.ts`
- Edit: `packages/contracts/src/lib/rules.ts`
- Edit: `frontend/rating-workspace/src/components/tabs/RulesTab.tsx`

Add four actions defined in contracts but not yet implemented:

| Action | Behavior |
|---|---|
| `flag` | Push string to `context.working._flags[]` — downstream checks `_flags` for manual review markers |
| `skip_step` | Push step name/type to `context.working._skipSteps[]` — execution engine reads this to skip steps |
| `copy_field` | Copy value from one working context field to another |
| `append` | Append a value to an array field in working context |

Also add defensive guards: division-by-zero check on `divide` action; NaN check on arithmetic actions.

### 0.4 Wire `skip_step` Into Execution Engine

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

Before executing each step, check `context.working._skipSteps`:

```typescript
const skipSteps = context.working?._skipSteps as string[] | undefined;
if (skipSteps?.includes(step.name) || skipSteps?.includes(step.stepType)) {
  stepResults.push({ stepId: step.id, status: 'skipped', durationMs: 0, ... });
  continue;
}
```

This enables rules to dynamically skip downstream steps — a simpler precursor to full conditional branching.

### 0.5 Scope Filtering for Mappings

**Files:**
- Edit: `services/product-config/src/mappings/mappings.controller.ts`
- Edit: `services/product-config/src/mappings/mappings.service.ts`
- Edit: `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

Add scope tag endpoints for mappings (mirrors existing rules scope tag pattern):
```
GET    /api/v1/mappings/:id/scope-tags
POST   /api/v1/mappings/:id/scope-tags     { scopeType, scopeValue }
DELETE /api/v1/mappings/:id/scope-tags/:tagId
```

When selecting which mapping to use, apply scope filtering (same AND/OR logic as rules-service). Fall back to unscoped mapping if no scoped match.

### 0.6 Stable Config Keys

**Why:** Config as Code (Phase 5) exports/imports config by `configKey`, not UUID. UUIDs differ between environments and break portability. Stable keys must be added now so that every entity created from this point forward has a portable identifier.

**Migration:** `db/migrations/XXX_add_config_keys.sql`

```sql
ALTER TABLE rules              ADD COLUMN config_key TEXT UNIQUE;
ALTER TABLE mappings           ADD COLUMN config_key TEXT UNIQUE;
ALTER TABLE orchestrators      ADD COLUMN config_key TEXT UNIQUE;
ALTER TABLE orchestrator_steps ADD COLUMN config_key TEXT UNIQUE;
ALTER TABLE custom_flows       ADD COLUMN config_key TEXT UNIQUE;
ALTER TABLE custom_flow_steps  ADD COLUMN config_key TEXT UNIQUE;
```

**Key format:** `{domain}:{entity-type}:{slug}` — e.g., `rating:rule:ny-building-surcharge`, `rating:orchestrator:imce-rate`, `rating:step:map-request-fields`

**Entity updates** (all 6 entities): add `configKey` column to TypeORM entity class.

**API behavior:**
- Accept `configKey` on create and update
- Auto-generate slug from `name` if `configKey` is not provided (lowercase, replace spaces/special chars with hyphens)
- Return `configKey` in all GET responses

**Files:**
- New: `db/migrations/XXX_add_config_keys.sql`
- Edit: `orchestrators/line-rating/src/entities/orchestrator.entity.ts`
- Edit: `orchestrators/line-rating/src/entities/orchestrator-step.entity.ts`
- Edit: `orchestrators/line-rating/src/entities/custom-flow.entity.ts`
- Edit: `orchestrators/line-rating/src/entities/custom-flow-step.entity.ts`
- Edit: `services/rules-service/src/rules/rule.entity.ts`
- Edit: `services/product-config/src/mappings/mapping.entity.ts`
- Edit: `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts` (auto-generate slug)
- Edit: `orchestrators/line-rating/src/custom-flows/custom-flows.service.ts` (auto-generate slug)
- Edit: `services/rules-service/src/rules/rules.service.ts` (auto-generate slug)
- Edit: `services/product-config/src/mappings/mappings.service.ts` (auto-generate slug)

### Phase 0 Verification

1. Execute IMCE `/rate` flow with a mapping containing `multiply` fields → verify `context.working` has multiplied values before JSON→XML step
2. Create a rule with `between` condition → verify it evaluates correctly
3. Create a rule with `flag` action → verify `_flags` appears in step output
4. Create a rule with `skip_step` action targeting "Call CGI Ratabase" → verify that step is skipped in execution
5. Create any entity (rule, mapping, orchestrator) without a `configKey` → verify slug is auto-generated
6. `npx nx run-many -t test` — all tests pass
7. `npx nx run-many -t typecheck` — no type errors

---

## Phase 1 — Conditional Branching: Backend (~1 week)

**Goal:** Branching works end-to-end via API. No UI changes. Existing linear flows continue unchanged.

### 1.1 Database Migration

**File:** `db/migrations/XXX_conditional_branching.sql`

```sql
-- Add next-step pointer for explicit graph wiring
ALTER TABLE orchestrator_steps
  ADD COLUMN default_next_step_id UUID REFERENCES orchestrator_steps(id) ON DELETE SET NULL;

ALTER TABLE custom_flow_steps
  ADD COLUMN default_next_step_id UUID REFERENCES custom_flow_steps(id) ON DELETE SET NULL;

-- Add branch decision logging to transaction step logs
ALTER TABLE transaction_step_logs
  ADD COLUMN branch_decision JSONB DEFAULT NULL;
  -- { conditionEvaluated, result, branchLabel, targetStepName }

-- Add execution path to transactions
ALTER TABLE transactions
  ADD COLUMN execution_path TEXT[] DEFAULT NULL;
  -- Ordered array of step IDs that actually executed
```

### 1.2 Contracts Update

**File:** `packages/contracts/src/lib/orchestrator.ts`

- Add `'branch'` to `OrchestratorStepType` union
- Add `BranchConfig` and `BranchCondition` interfaces:

```typescript
interface BranchCondition {
  label: string;               // "Has DUNS number"
  conditionExpression: string; // "working.dunsNumber != null"
  targetStepId: string;        // UUID of step to jump to
}
interface BranchConfig {
  branches: BranchCondition[]; // Evaluated in order, first match wins
  defaultTargetStepId?: string; // Fallback if no branch matches
}
```

- Add optional `defaultNextStepId?: string` to `StepConfig`

**File:** `packages/contracts/src/lib/execution.ts`

- Add `branchDecision?: { conditionEvaluated: string; result: boolean; branchLabel: string; targetStepName: string }` to `StepResult`
- Add `executionPath?: string[]` to `ExecutionResult`
- Add `nextStepId?: string` to `StepResult` (handler can redirect execution)

### 1.3 Branch Handler

**New file:** `orchestrators/core-rating/src/handlers/branch.handler.ts`

Handler type: `'branch'`

`execute(context, config)`:
1. Loop through `config.branches` in order
2. Evaluate each `conditionExpression` using existing `vm.runInNewContext` (reuse `evaluateConditionExpression` from `execution.service.ts`)
3. First truthy match → return `{ status: 'completed', nextStepId: branch.targetStepId, output: { branchLabel, conditionEvaluated, result: true } }`
4. No match → use `config.defaultTargetStepId` or fall through to next step by order
5. Log branch decision in step result

`validate(config)`: ensure `branches` array is non-empty; each entry has `targetStepId` and `conditionExpression`.

Register in `handlers.module.ts`.

### 1.4 Execution Loop Refactor

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

Convert `for (const step of activeSteps)` to graph-based traversal:

```typescript
const stepMap = new Map(activeSteps.map(s => [s.id, s]));
const stepByOrder = [...activeSteps]; // sorted by stepOrder
let currentStepId = stepByOrder[0]?.id;
const visited = new Set<string>();
const executionPath: string[] = [];
const MAX_ITERATIONS = 100;
let iterations = 0;

while (currentStepId && iterations < MAX_ITERATIONS) {
  if (visited.has(currentStepId) && iterations > visited.size * 2) {
    throw new Error(`Potential cycle at step ${currentStepId}`);
  }
  visited.add(currentStepId);
  iterations++;

  const step = stepMap.get(currentStepId);
  if (!step) break;

  // Existing skip/condition logic unchanged...
  // Execute step handler...
  executionPath.push(step.id);

  // Determine next step
  const handlerNextStepId = result?.nextStepId;   // From branch handler
  const configNextStepId = step.config?.defaultNextStepId;

  if (handlerNextStepId) {
    currentStepId = handlerNextStepId;
  } else if (configNextStepId) {
    currentStepId = configNextStepId;
  } else {
    // Fallback: next by stepOrder (backward compatible)
    const currentIdx = stepByOrder.findIndex(s => s.id === step.id);
    currentStepId = stepByOrder[currentIdx + 1]?.id ?? null;
  }
}
```

**Backward compatibility:** If no `nextStepId` or `defaultNextStepId` is set (all existing flows), falls back to `stepOrder` ordering — existing orchestrators work without any change.

### 1.5 Custom Flow Handler Update

**File:** `orchestrators/core-rating/src/handlers/run-custom-flow.handler.ts`

Apply the same graph traversal logic. Extract the traversal loop into a shared function (e.g., `executeStepGraph()`) to avoid duplication between `execution.service.ts` and this handler.

### 1.6 Status Service Update

**File:** `services/status-service/src/` (multiple files)

- Accept `branchDecision` field in step log creation
- Accept `executionPath` in transaction completion
- Return these fields in GET responses

### 1.7 Line-Rating API Update

**Files:**
- `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts`
- `orchestrators/line-rating/src/custom-flows/custom-flows.service.ts`
- `orchestrators/line-rating/src/entities/orchestrator-step.entity.ts`
- `orchestrators/line-rating/src/entities/custom-flow-step.entity.ts`

- Step CRUD: accept and persist `defaultNextStepId`
- Step response: include `defaultNextStepId`
- Validation: `defaultNextStepId` must reference a step in the same orchestrator/flow
- Validation for `branch` step type: config must have a valid `branches` array with `targetStepId` values referencing existing steps in the same flow

### 1.8 Tests

- Unit test: `BranchHandler` — multiple conditions, default fallback, no match
- Unit test: Execution loop graph traversal — linear (backward compat), branching, cycle detection
- Integration test: Full rating flow with branch step (D&B enrichment pattern — with and without DUNS number)

### Phase 1 Verification

1. Create orchestrator: Validate → Branch (`working.dunsNumber != null`) → [YES: Enrich D&B → Map D&B] → [NO: skip] → Call Engine → Respond
2. Send rating request WITH `dunsNumber` → verify D&B steps execute
3. Send rating request WITHOUT `dunsNumber` → verify D&B steps are skipped, engine called directly
4. Verify existing linear flows (GL product) still work unchanged
5. `npx nx run-many -t test` — all existing tests pass
6. Check transaction step logs include `branchDecision` for branch steps

---

## Phase 2 — Conditional Branching: Execution Tracking (~2 days)

**Goal:** Every transaction records which path was taken, which branches were evaluated, and which steps were skipped by branching.

### 2.1 Transaction Record Enhancement

**File:** `services/status-service/src/` (multiple files)

- Store `executionPath` (ordered step IDs that ran) on transaction completion
- Store `totalStepsInFlow` vs `executedSteps` vs `skippedByBranch` counts
- Step logs for branch steps include the full decision: condition text, result, which path was taken

### 2.2 API Response Enhancement

**File:** `orchestrators/core-rating/src/rating/rating.service.ts`

- Include `executionPath` in the rating response
- Include `branchDecisions` summary (array of branch step results)
- Step results include `wasOnBranch: boolean` and `branchLabel?: string`

### 2.3 Flow Definition Graph API

**File:** `orchestrators/line-rating/src/orchestrator/orchestrator.controller.ts`

New endpoint: `GET /orchestrators/:code/flow/:endpoint/graph`

Returns steps as a graph structure:

```json
{
  "nodes": [{ "id": "...", "name": "...", "stepType": "...", "config": {} }],
  "edges": [
    { "from": "step-1", "to": "step-2", "label": "default" },
    { "from": "step-branch", "to": "step-dnb", "label": "Has DUNS", "condition": "..." },
    { "from": "step-branch", "to": "step-rate", "label": "No DUNS (default)" }
  ]
}
```

This powers the graph visualization in Phase 3+ without the frontend needing to reconstruct the graph from step configs.

---

## Phase 3 — Conditional Branching: Frontend Visualization (~3 days)

**Goal:** Transactions, Insights, and Test Rating pages correctly display branching flows. No editing yet.

### 3.1 ExecutionFlowDiagram.tsx — Branch-Aware Rendering

**File:** `frontend/rating-workspace/src/components/flow/ExecutionFlowDiagram.tsx`

Keep the existing horizontal CSS card layout. Only show **executed steps** in execution order. Branch steps show a special badge.

Add to each branch step card:
- Branch icon (`git-branch` from lucide-react)
- "Took: [branchLabel]" pill badge below the step type badge
- Tooltip showing all evaluated conditions and which one matched

Steps on untaken branches do not appear — zero layout changes required.

### 3.2 TestingFlowCircles.tsx — Branch-Aware Circles

**File:** `frontend/rating-workspace/src/components/flow/TestingFlowCircles.tsx`

Show only executed steps. Branch step circles get a distinct icon (split arrow instead of number). Tooltip shows branch decision.

### 3.3 StepDetailPanel.tsx — Branch Decision Display

**File:** `frontend/rating-workspace/src/components/flow/StepDetailPanel.tsx`

Add new "Branch Decision" section for branch steps:
- Condition evaluated (code block)
- Result: true/false
- Path taken: [branchLabel]
- Target step: [stepName]
- List of all branches — green highlight on taken, gray on untaken

### 3.4 Transactions.tsx — Step Count & Path

**File:** `frontend/rating-workspace/src/pages/Transactions.tsx`

- "STEPS" column: change from "7/7" to "7 executed" (total varies by branch)
- Expanded row: show execution path breadcrumb above the flow diagram
- Step logs list: branch steps show decision inline

### 3.5 Insights.tsx — Same Changes

**File:** `frontend/rating-workspace/src/pages/Insights.tsx`

Same step count and flow diagram changes as Transactions.

### 3.6 TestRating.tsx — Branch Results

**File:** `frontend/rating-workspace/src/pages/TestRating.tsx`

- Result summary: "Steps: 7 executed (2 skipped by branch)"
- Both `TestingFlowCircles` and `ExecutionFlowDiagram` show branch-aware rendering
- Step trace expandable list: branch steps show decision details inline

### 3.7 Frontend Types Update

**Files:**
- `frontend/rating-workspace/src/api/transactions.ts`
- `frontend/rating-workspace/src/api/orchestrator.ts`

- Add `branchDecision` to `StepLog` type
- Add `executionPath` to `Transaction` type
- Add `defaultNextStepId` to `OrchestratorStep` type

### Phase 3 Verification

1. Open Transactions page → expand a branched transaction → verify flow diagram shows branch badge
2. Open Insights page → same verification
3. Open Test Rating → run a branched flow → verify both `TestingFlowCircles` and `ExecutionFlowDiagram` render correctly
4. Click a branch step node → verify `StepDetailPanel` shows branch decision details

---

## Phase 4 — Conditional Branching: Frontend Editing (~3 days)

**Goal:** Users can add and configure `branch` steps in the orchestrator and custom flow editors.

### 4.1 BranchConfigForm Component

**New file:** `frontend/rating-workspace/src/components/flow/BranchConfigForm.tsx`

Shared component used by both `ProductDetail.tsx` and `CustomFlowEdit.tsx`.

Form layout:
- Title: "Branch Conditions"
- List of branch rows (add/remove/reorder):
  - **Label** (text input): e.g., "Has DUNS number"
  - **Condition** (text input): e.g., `working.dunsNumber != null`
  - **Target Step** (dropdown): populated from existing steps in the same flow
- **Default path** (dropdown): step to jump to if no condition matches
- "Add Branch" button

### 4.2 ProductDetail.tsx — Branch Step Type

**File:** `frontend/rating-workspace/src/pages/ProductDetail.tsx`

- Add `'branch'` to `STEP_TYPES` dropdown
- When `branch` is selected in the step editor, render `<BranchConfigForm />`
- Add optional "After this step, go to..." dropdown (`defaultNextStepId`) for all step types — lets users wire non-branch steps to specific merge points

### 4.3 CustomFlowEdit.tsx — Branch Step Type

**File:** `frontend/rating-workspace/src/pages/CustomFlowEdit.tsx`

- Add `'branch'` to allowed step types for custom flows
- Reuse `<BranchConfigForm />` (same component)
- Add `defaultNextStepId` dropdown for all step types

### 4.4 Frontend Validation

Before save:
- Branch step must have at least 1 condition
- All `targetStepId` references must point to existing steps in the same flow
- No orphan steps (every step must be reachable from step 1)
- Cycle warning (not blocking — loops may be intentional for retry patterns)

### Phase 4 Verification

1. Open Orchestrator tab → add a `branch` step
2. Configure two conditions with target steps → save
3. Verify step is persisted with correct config via API
4. Run test from Test Rating → verify branch executes correctly

---

## Phase 5 — Config as Code: Foundation (Post-MVP, ~1 week)

**Goal:** Platform configuration (orchestrators, rules, mappings, scopes) lives in YAML files checked into git. Deploying to a new environment is idempotent and auditable.

**Prerequisite:** Phase 0.6 (stable keys) must be complete. All entities must have `configKey` set.

### 5.1 YAML Schema Design

Config is organized by domain in the repository:

```
domains/
  rating/
    config/
      orchestrators.yaml   # flows, steps, branch conditions
      rules.yaml           # all rules with conditions/actions
      mappings.yaml        # field mappings and transforms
      scopes.yaml          # scope definitions
```

All references use `configKey`, not UUID — config is environment-agnostic.

Example `rules.yaml` entry:
```yaml
- configKey: rating:rule:ny-building-age-surcharge
  name: NY Building Age Surcharge
  productLineCode: IMCE
  phase: pre_rating
  priority: 10
  conditions:
    - field: building.yearBuilt
      operator: less_than
      value: 1990
  actions:
    - actionType: surcharge
      targetField: premium.base
      value: 0.15
```

### 5.2 Export Script

**File:** `scripts/export-config.ts`

```
npx ts-node scripts/export-config.ts --domain=rating --output=domains/rating/config/
```

- Reads from DB, generates YAML keyed by `configKey`
- Used once initially to bootstrap YAML from the existing dev database
- Also useful to capture ad-hoc changes made via UI before committing them

### 5.3 Apply Script

**File:** `scripts/apply-config.ts`

```
npx ts-node scripts/apply-config.ts --domain=rating --env=prod
```

- Reads YAML, upserts by `configKey` (fully idempotent)
- Runs after DB migrations on container startup
- Handles create, update, and soft-delete (marks removed entities as inactive)
- Same pipeline, zero new tooling for client DevOps teams

### 5.4 Config History Table

**Migration:** `db/migrations/XXX_config_history.sql`

```sql
CREATE TABLE config_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,
  config_key   TEXT NOT NULL,
  version      TEXT,
  config_snapshot JSONB NOT NULL,
  changed_by   TEXT,
  changed_at   TIMESTAMPTZ DEFAULT now(),
  git_sha      TEXT,
  environment  TEXT,
  change_reason TEXT
);
```

- Auto-populated by `apply-config.ts` on each deploy
- Enables point-in-time queries: "What rules were active on March 1st in production?"
- Source of truth for compliance and audit

### 5.5 Wire Apply-Config Into Container Startup

- Add `apply-config` as a step in `scripts/run-migrations.sh` (or as a separate step in Dockerfile `CMD`)
- Same pipeline, no new infrastructure required

### 5.6 CI Pipeline Step

```yaml
# .github/workflows/deploy.yml
- name: Run migrations
  run: ./scripts/run-migrations.sh

- name: Apply domain config
  run: npx ts-node scripts/apply-config.ts --domain=rating --env=$TARGET_ENV
```

### Phase 5 Verification

1. Export existing dev DB config to YAML → commit
2. Deploy to staging with a fresh schema → run migrations → run apply-config
3. Verify staging has identical rules, mappings, and orchestrators as dev via `config_history`
4. Promote to prod — same process, same YAML, same result
5. Check `config_history` table in both environments: same `git_sha`, same entities

---

## Phase 6 — Config as Code: Publish Config UI (Post-MVP, ~1 week)

**Goal:** System architects can publish UI changes back to git without leaving the platform — creating an auditable PR for review before production deployment.

### 6.1 "Publish Config" Button

- Located on the Orchestrator tab (and Rules/Mappings tabs)
- Exports current domain config diff (what changed since last git commit)
- Calls the GitHub API to create a PR with the YAML changes

### 6.2 GitHub PR Workflow

1. User clicks "Publish Config"
2. Platform calls `export-config.ts` in-process for the current domain
3. Diffs against the last committed YAML (`git diff`)
4. Creates a GitHub PR via GitHub API with the diff as the commit
5. SA/DevOps reviews the PR diff in GitHub — approves
6. CI builds new artifact → deploys → `apply-config.ts` runs

### 6.3 UI State

- "Pending publish" badge on tabs with unpublished changes (any entity modified since last `git_sha` in `config_history`)
- Prod UI is read-only (no direct DB writes from UI in production — all changes go through PR)
- PR link shown in UI after publish — "View PR #42"

### 6.4 Files

- New: `frontend/rating-workspace/src/components/PublishConfigButton.tsx`
- New: `orchestrators/line-rating/src/config/config-export.controller.ts` (triggers export + GitHub PR creation)
- Edit: `frontend/rating-workspace/src/pages/ProductDetail.tsx` (add button)
- Edit: `frontend/rating-workspace/src/pages/RulesTab.tsx` (add button + pending badge)
- Edit: `frontend/rating-workspace/src/pages/MappingsTab.tsx` (add button + pending badge)

---

## Future Phases (Post-MVP)

### Flow Designer (from conditional-branching-plan.md Phase 7)
- Dedicated `/products/:code/orchestrator/:flowEndpoint/designer` route
- Visual drag-and-drop canvas alongside the existing step list view (additive, not a replacement)
- Step palette sidebar: dynamically populated from API — step types, custom flows, mappings, rules, systems
- Flow templates: pre-wired starting points (Guidewire→CGI, D&B Enrichment Branch, Simple Validation, Blank)
- AI-assisted step suggestions via existing AWS Bedrock infrastructure

### Visual Graph Editor (from conditional-branching-plan.md Phase 5)
- React Flow (`@xyflow/react`) based editor embedded in the Flow Designer
- Nodes = steps; edges = connections with branch condition labels
- Auto-layout via Dagre/ELK.js; minimap; zoom/pan
- Read-only mode for `ExecutionFlowDiagram` in Transactions/Insights showing full graph with highlighted execution path

### Advanced Branching (from conditional-branching-plan.md Phase 6)
- **Parallel execution:** New `parallel` step type; `Promise.all()` on branch paths; merge step waits for all
- **Loop/retry:** `defaultNextStepId` pointing to an earlier step; `maxIterations` guard
- **Sub-flow branching:** Branch target can be a `run_custom_flow` step — enables modular flow composition

### Multi-Domain Expansion
- Claims processing domain
- Billing and payment domain
- Underwriting domain
- Policy issuance domain

### Config Versioning
- Semantic versions on config bundles
- Blue/green config deployment (test new config on a subset of transactions)
- Rollback to previous config version without redeploying

---

## Master Files Table

| Phase | File | Type |
|---|---|---|
| **0.1** | `orchestrators/core-rating/src/handlers/transforms/transform-executor.ts` | New |
| **0.1** | `orchestrators/core-rating/src/handlers/transforms/transform-executor.spec.ts` | New |
| **0.1** | `orchestrators/core-rating/src/handlers/field-mapping.handler.ts` | Modify |
| **0.2–0.3** | `services/rules-service/src/rules/rules.service.ts` | Modify |
| **0.2–0.3** | `packages/contracts/src/lib/rules.ts` | Modify |
| **0.2–0.3** | `frontend/rating-workspace/src/components/tabs/RulesTab.tsx` | Modify |
| **0.4** | `orchestrators/core-rating/src/execution/execution.service.ts` | Modify |
| **0.5** | `services/product-config/src/mappings/mappings.controller.ts` | Modify |
| **0.5** | `services/product-config/src/mappings/mappings.service.ts` | Modify |
| **0.6** | `db/migrations/XXX_add_config_keys.sql` | New |
| **0.6** | `orchestrators/line-rating/src/entities/orchestrator.entity.ts` | Modify |
| **0.6** | `orchestrators/line-rating/src/entities/orchestrator-step.entity.ts` | Modify |
| **0.6** | `orchestrators/line-rating/src/entities/custom-flow.entity.ts` | Modify |
| **0.6** | `orchestrators/line-rating/src/entities/custom-flow-step.entity.ts` | Modify |
| **0.6** | `services/rules-service/src/rules/rule.entity.ts` | Modify |
| **0.6** | `services/product-config/src/mappings/mapping.entity.ts` | Modify |
| **0.6** | `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts` | Modify |
| **0.6** | `orchestrators/line-rating/src/custom-flows/custom-flows.service.ts` | Modify |
| **0.6** | `services/rules-service/src/rules/rules.service.ts` | Modify |
| **0.6** | `services/product-config/src/mappings/mappings.service.ts` | Modify |
| **1** | `db/migrations/XXX_conditional_branching.sql` | New |
| **1** | `packages/contracts/src/lib/orchestrator.ts` | Modify |
| **1** | `packages/contracts/src/lib/execution.ts` | Modify |
| **1** | `orchestrators/core-rating/src/handlers/branch.handler.ts` | New |
| **1** | `orchestrators/core-rating/src/handlers/handlers.module.ts` | Modify |
| **1** | `orchestrators/core-rating/src/execution/execution.service.ts` | Modify |
| **1** | `orchestrators/core-rating/src/handlers/run-custom-flow.handler.ts` | Modify |
| **1** | `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts` | Modify |
| **1** | `orchestrators/line-rating/src/entities/orchestrator-step.entity.ts` | Modify |
| **1** | `orchestrators/line-rating/src/custom-flows/custom-flows.service.ts` | Modify |
| **1** | `orchestrators/line-rating/src/entities/custom-flow-step.entity.ts` | Modify |
| **2** | `services/status-service/src/` (multiple files) | Modify |
| **2** | `orchestrators/core-rating/src/rating/rating.service.ts` | Modify |
| **2** | `orchestrators/line-rating/src/orchestrator/orchestrator.controller.ts` | Modify |
| **3** | `frontend/rating-workspace/src/components/flow/ExecutionFlowDiagram.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/components/flow/TestingFlowCircles.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/components/flow/StepDetailPanel.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/pages/Transactions.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/pages/Insights.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/pages/TestRating.tsx` | Modify |
| **3** | `frontend/rating-workspace/src/api/transactions.ts` | Modify |
| **3** | `frontend/rating-workspace/src/api/orchestrator.ts` | Modify |
| **4** | `frontend/rating-workspace/src/pages/ProductDetail.tsx` | Modify |
| **4** | `frontend/rating-workspace/src/pages/CustomFlowEdit.tsx` | Modify |
| **4** | `frontend/rating-workspace/src/components/flow/BranchConfigForm.tsx` | New |
| **5** | `db/migrations/XXX_config_history.sql` | New |
| **5** | `scripts/export-config.ts` | New |
| **5** | `scripts/apply-config.ts` | New |
| **6** | `frontend/rating-workspace/src/components/PublishConfigButton.tsx` | New |
| **6** | `orchestrators/line-rating/src/config/config-export.controller.ts` | New |
| **6** | `frontend/rating-workspace/src/pages/ProductDetail.tsx` | Modify |

---

## Implementation Priority Summary

| Phase | What | Why | Approx Effort |
|---|---|---|---|
| **0** | Rules + Mapping Engine + Stable Keys | Engine must work correctly; stable keys unlock Config as Code | ~1 week |
| **1** | Conditional Branching Backend | Core feature; graph execution + branch step type | ~1 week |
| **2** | Execution Tracking | Visibility into which path was taken per transaction | ~2 days |
| **3** | Branching Frontend (view) | Client-visible; branch-aware flow diagrams | ~3 days |
| **4** | Branching Frontend (edit) | Client-visible; users can build branching flows | ~3 days |
| **5** | Config as Code Foundation | Deployment story; idempotent, auditable config promotion | ~1 week |
| **6** | Publish Config UI | Enterprise polish; UI → GitHub PR workflow | ~1 week |
| **Future** | Flow Designer, Visual Graph Editor, Advanced Branching, Multi-domain | Next tier post-MVP | TBD |
