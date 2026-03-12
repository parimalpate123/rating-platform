# Conditional Branching — Implementation Plan

## Context

InsuRateConnect's orchestration engine executes steps in a **linear sequence** (sorted by `stepOrder`). Real-world insurance rating flows require **conditional branching** — e.g., "if DUNS number exists, call D&B for enrichment; otherwise skip to rating engine." Today the platform can only skip individual steps via rules (`_skipSteps`) or condition expressions, but cannot fork to genuinely different execution paths.

This feature adds a `branch` step type, graph-based execution, and updates all visualization surfaces (Transactions, Insights, Test Rating, Orchestrator config, Custom Flows) to render and configure branching flows.

---

## Rollback / Fallback Plan

This is a major change. The following strategy ensures we can return to the current linear execution state at any point without data loss.

### Git Strategy

- All work lives on a long-lived `feature/conditional-branching` branch
- `main` is never touched until Phase 1 is fully tested and verified
- Each phase is a separate PR, merged incrementally — rollback by reverting the PR

### Feature Flag

Add a `ENABLE_BRANCH_STEPS` environment variable (default: `false` in production, `true` in dev/staging).

**Backend behavior when flag is OFF:**
- `line-rating` API rejects creation of `branch` step type (400 error)
- `core-rating` execution service uses the original linear `for` loop (flag-guarded code path)
- `defaultNextStepId` column is ignored

**Frontend behavior when flag is OFF:**
- `branch` is hidden from the step type dropdown
- No branch-related UI elements are rendered

This means you can deploy Phase 1 code to production with the flag off and turn it on only when ready.

### Database Rollback (Down Migration)

All migration changes are **additive only** (`ADD COLUMN`) — no existing columns are modified or dropped. A down migration script will be provided alongside each up migration:

```sql
-- down: XXX_conditional_branching_down.sql
ALTER TABLE orchestrator_steps DROP COLUMN IF EXISTS default_next_step_id;
ALTER TABLE custom_flow_steps DROP COLUMN IF EXISTS default_next_step_id;
ALTER TABLE transaction_step_logs DROP COLUMN IF EXISTS branch_decision;
ALTER TABLE transactions DROP COLUMN IF EXISTS execution_path;
```

Running the down migration restores the schema to its pre-feature state. Existing data (products, steps, transactions) is unaffected.

### Execution Engine Backward Compatibility

The graph traversal in Phase 1.4 is designed so that if **no** `nextStepId` or `defaultNextStepId` is present (i.e., all existing flows), it falls back exactly to `stepOrder`-based linear execution. No existing orchestrators need to be touched.

Verified by: running the full GL product rating flow before and after the code change and confirming identical step execution order and output.

### Rollback Decision Checklist

| Situation | Action |
|---|---|
| Phase 1 tests fail | Revert PR, stays on `main` unaffected |
| Phase 1 deployed but bugs found in prod | Set `ENABLE_BRANCH_STEPS=false`, existing flows immediately revert to linear |
| Schema issues after migration | Run down migration script, redeploy previous image |
| Phase 3+ UI issues | Feature flag hides all branch UI; backend unaffected |
| Full abort | Revert feature branch PRs, run down migration — back to current state |

---

## Phase 0 — Rules & Mapping Engine Wiring (Prerequisite)

**Goal:** Before building conditional branching, the core execution engine must be fully functional. This phase completes the pending P0/P1 items from [`mapping-and-rules-enhancement-plan.md`](./mapping-and-rules-enhancement-plan.md) so that rules and mappings actually work end-to-end during a rating flow.

**Why this is a prerequisite:** Branching relies on `conditionExpression` evaluation against `context.working`. If mapping transforms aren't applied and rules aren't correctly modifying working context, branch conditions will evaluate against stale/incomplete data — making the entire feature unreliable.

### 0.1 Field-Level Transformation Engine

**Files:**
- New: `orchestrators/core-rating/src/handlers/transforms/transform-executor.ts`
- Edit: `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

Implement the `executeTransform()` engine and wire it into the `FieldMappingHandler`. Currently **all 16 transformation types beyond direct copy are ignored** — multiply, divide, date format, expression, lookup, etc. This means `context.working` going into downstream steps (JSON→XML, Call Engine) is wrong.

Transformation types to implement:

| Type | Logic |
|---|---|
| `constant` | Return fixed `transformConfig.constantValue` |
| `multiply` | `value * transformConfig.factor` |
| `divide` | `value / transformConfig.divisor` (guard ÷0) |
| `round` | Round to `transformConfig.decimals` places |
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

Also wire in: required field validation (`isRequired: true`) and skip field logic (`transformConfig.skipMapping`).

### 0.2 Missing Rule Operators

**File:** `services/rules-service/src/rules/rules.service.ts`

Add two operators that are defined in contracts but not implemented:

- **`between`** — `fieldValue >= min && fieldValue <= max` (condition value is `[min, max]`)
- **`regex`** — `new RegExp(conditionValue).test(fieldValue)`

**File:** `packages/contracts/src/lib/rules.ts` — add to `RuleOperator` union.

**File:** `frontend/rating-workspace/src/components/tabs/RulesTab.tsx` — add to operator dropdown; `between` shows two inputs (min/max).

### 0.3 Missing Rule Actions

**File:** `services/rules-service/src/rules/rules.service.ts`

Add four actions that are defined in contracts but not implemented:

| Action | Behavior |
|---|---|
| `flag` | Push a string flag to `context.working._flags[]` — downstream can check `_flags` for manual review markers |
| `skip_step` | Push step name/type to `context.working._skipSteps[]` — execution engine reads this to skip steps |
| `copy_field` | Copy value from one working context field to another |
| `append` | Append a value to an array field in working context |

Also add defensive guards: division-by-zero check on `divide` action, NaN check on arithmetic actions.

**File:** `packages/contracts/src/lib/rules.ts` — add to `RuleActionType` union.

**File:** `frontend/rating-workspace/src/components/tabs/RulesTab.tsx` — add to action type dropdown.

### 0.4 Wire `skip_step` Into Execution Engine

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

Before executing each step, check `context.working._skipSteps`:

```typescript
const skipSteps = context.working?._skipSteps as string[] | undefined;
if (skipSteps?.includes(step.name) || skipSteps?.includes(step.stepType)) {
  stepResults.push({ stepId: step.id, status: 'skipped', ... });
  continue;
}
```

This enables rules to dynamically skip downstream steps based on conditions — a simpler precursor to full conditional branching.

### 0.5 Scope Filtering for Mappings

**File:** `services/product-config/src/mappings/mappings.controller.ts`

Add scope tag endpoints for mappings (mirrors existing rules scope tag pattern):
```
GET    /api/v1/mappings/:id/scope-tags
POST   /api/v1/mappings/:id/scope-tags     { scopeType, scopeValue }
DELETE /api/v1/mappings/:id/scope-tags/:tagId
```

**File:** `orchestrators/core-rating/src/handlers/field-mapping.handler.ts`

When selecting which mapping to use, apply scope filtering (same AND/OR logic as rules-service). Fall back to unscoped mapping if no scoped match.

### Phase 0 Verification

1. Execute IMCE `/rate` flow with a mapping containing `multiply` fields → verify `context.working` has multiplied values before JSON→XML step
2. Create a rule with `between` condition → verify it evaluates correctly
3. Create a rule with `flag` action → verify `_flags` appears in step output
4. Create a rule with `skip_step` action targeting "Call CGI Ratabase" → verify that step is skipped in execution
5. `npx nx run-many -t test` — all tests pass
6. `npx nx run-many -t typecheck` — no type errors

> **Full detail** for each item above is in [`mapping-and-rules-enhancement-plan.md`](./mapping-and-rules-enhancement-plan.md) — this phase implements the P0 and P1 items from that plan.

---

## Phase 1 — Backend: Branch Step Type & Graph Execution

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
- Add `BranchConfig` interface:
  ```typescript
  interface BranchCondition {
    label: string;                    // "Has DUNS number"
    conditionExpression: string;      // "working.dunsNumber != null"
    targetStepId: string;             // UUID of step to jump to
  }
  interface BranchConfig {
    branches: BranchCondition[];      // Evaluated in order, first match wins
    defaultTargetStepId?: string;     // Fallback if no branch matches
  }
  ```
- Add optional `defaultNextStepId?: string` to `StepConfig`

**File:** `packages/contracts/src/lib/execution.ts`

- Add `branchDecision?: { conditionEvaluated: string; result: boolean; branchLabel: string; targetStepName: string }` to `StepResult`
- Add `executionPath?: string[]` to `ExecutionResult`
- Add `nextStepId?: string` to `StepResult` (handler can redirect execution)

### 1.3 Branch Handler

**New file:** `orchestrators/core-rating/src/handlers/branch.handler.ts`

- Handler type: `'branch'`
- `execute(context, config)`:
  1. Loop through `config.branches` in order
  2. Evaluate each `conditionExpression` using existing `vm.runInNewContext` (same as condition expressions in execution.service.ts, reuse `evaluateConditionExpression`)
  3. First truthy match → return `{ status: 'completed', nextStepId: branch.targetStepId, output: { branchLabel, conditionEvaluated, result: true } }`
  4. No match → use `config.defaultTargetStepId` or continue to next step by order
  5. Log the branch decision in step result
- `validate(config)`: Ensure branches array is non-empty, each has targetStepId and conditionExpression
- Register in `handlers.module.ts`

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
  // Cycle detection
  const visitKey = `${currentStepId}-${iterations}`;
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

  // Determine next step (NEW)
  const handlerNextStepId = result?.nextStepId;  // From branch handler
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

**Backward compatibility:** If no `nextStepId` or `defaultNextStepId` is set, falls back to `stepOrder` ordering — existing flows work without any change.

### 1.5 Custom Flow Handler Update

**File:** `orchestrators/core-rating/src/handlers/run-custom-flow.handler.ts`

Apply the same graph traversal logic (extract shared function from execution.service.ts to avoid duplication).

### 1.6 Status Service Update

**File:** `services/status-service/src/`

- Accept `branchDecision` field in step log creation
- Accept `executionPath` in transaction completion
- Return these fields in GET responses

### 1.7 Line-Rating API Update

**Files:** `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts` and `custom-flows/custom-flows.service.ts`

- Step CRUD: accept and persist `defaultNextStepId`
- Step response: include `defaultNextStepId`
- Add validation: `defaultNextStepId` must reference a step in the same orchestrator/flow
- Add validation for `branch` step type: config must have valid `branches` array with `targetStepId` values referencing existing steps

### 1.8 Tests

- Unit test: BranchHandler with multiple conditions, default fallback, no match
- Unit test: Execution loop graph traversal — linear (backward compat), branching, cycle detection
- Integration test: Full rating flow with branch step (D&B enrichment pattern)

---

## Phase 2 — Backend: Execution Path Tracking & Enhanced Logging

**Goal:** Every transaction records which path was taken, which branches were evaluated, and which steps were skipped by branching.

### 2.1 Transaction Record Enhancement

**File:** `services/status-service/`

- Store `executionPath` (ordered step IDs that ran) on transaction completion
- Store `totalStepsInFlow` vs `executedSteps` vs `skippedByBranch` counts
- Step logs for branch steps include the full decision: condition text, result, which path was taken

### 2.2 API Response Enhancement

**Files:** `orchestrators/core-rating/src/rating/rating.service.ts`

- Include `executionPath` in the rating response
- Include `branchDecisions` summary (array of branch step results)
- Step results include `wasOnBranch: boolean` and `branchLabel?: string`

### 2.3 Flow Definition API

**File:** `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts`

- New endpoint: `GET /orchestrators/:code/flow/:endpoint/graph` — returns steps as a graph structure:
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
- This powers the graph visualization in the UI without frontend needing to reconstruct the graph from step configs

---

## Phase 3 — Frontend: Visualization Updates (Read-Only)

**Goal:** Transactions, Insights, and Test Rating pages correctly display branching flows. No editing yet.

### 3.1 ExecutionFlowDiagram.tsx — Branch-Aware Rendering

**File:** `frontend/rating-workspace/src/components/flow/ExecutionFlowDiagram.tsx`

**Current:** Horizontal CSS cards in a row with chevron arrows.

**Change (Minimal, recommended for Phase 3):**
Keep the linear card layout but only show **executed steps** in execution order. Branch steps show a special badge: "Branch: took [label]". Steps on untaken branches don't appear. This requires zero layout changes.

Add to each branch step card:
- Branch icon (git-branch from lucide-react)
- "Took: [branchLabel]" pill badge below the step type badge
- Tooltip showing all evaluated conditions and which one matched

### 3.2 TestingFlowCircles.tsx — Branch-Aware Circles

**File:** `frontend/rating-workspace/src/components/flow/TestingFlowCircles.tsx`

Same approach as ExecutionFlowDiagram — show only executed steps. Branch step circles get a distinct icon (split arrow instead of number). Tooltip shows branch decision.

### 3.3 StepDetailPanel.tsx — Branch Decision Display

**File:** `frontend/rating-workspace/src/components/flow/StepDetailPanel.tsx`

Add new section for branch steps:
- "Branch Decision" card showing:
  - Condition evaluated (code block)
  - Result: true/false
  - Path taken: [branchLabel]
  - Target step: [stepName]
- List of all branches with which one was selected (green highlight on taken, gray on untaken)

### 3.4 Transactions.tsx — Step Count & Path

**File:** `frontend/rating-workspace/src/pages/Transactions.tsx`

- "STEPS" column: change from "7/7" to "7 executed" (since total varies by branch)
- Expanded row: show execution path breadcrumb above the flow diagram
- Step logs list: branch steps show decision inline

### 3.5 Insights.tsx — Same Changes

**File:** `frontend/rating-workspace/src/pages/Insights.tsx`

- Same step count and flow diagram changes as Transactions
- Search filters: optionally filter by "branch taken" (future)

### 3.6 TestRating.tsx — Branch Results

**File:** `frontend/rating-workspace/src/pages/TestRating.tsx`

- Result summary: "Steps: 7 executed (2 skipped by branch)"
- Both TestingFlowCircles and ExecutionFlowDiagram show branch-aware rendering
- Step trace expandable list: branch steps show decision details inline

### 3.7 Frontend Types Update

**File:** `frontend/rating-workspace/src/api/transactions.ts` and `orchestrator.ts`

- Add `branchDecision` to `StepLog` type
- Add `executionPath` to `Transaction` type
- Add `defaultNextStepId` to `OrchestratorStep` type

---

## Phase 4 — Frontend: Branch Step Configuration (Editing)

**Goal:** Users can add and configure `branch` steps in the orchestrator and custom flow editors.

### 4.1 Branch Step Config Form

**File:** `frontend/rating-workspace/src/pages/ProductDetail.tsx` (OrchestratorTab section)

Add `branch` to the STEP_TYPES dropdown list.

When `branch` is selected, render a **Branch Config Form**:
- Title: "Branch Conditions"
- List of branch rows (add/remove/reorder):
  - Label (text input): e.g., "Has DUNS number"
  - Condition (code editor or text input): e.g., `working.dunsNumber != null`
  - Target Step (dropdown): populated from existing steps in the same flow
  - Test button (optional): evaluate condition against sample working context
- Default path (dropdown): step to jump to if no condition matches
- "Add Branch" button to add more conditions

### 4.2 CustomFlowEdit.tsx — Same Config Form

**File:** `frontend/rating-workspace/src/pages/CustomFlowEdit.tsx`

- Add `'branch'` to allowed step types for custom flows
- Reuse the same branch config form component (extract to shared component)

### 4.3 Step Wiring — defaultNextStepId

Both orchestrator and custom flow step editors get an optional "Next Step" dropdown:
- Label: "After this step, go to..."
- Options: all other steps in the flow + "(next by order)" default
- This lets users wire non-branch steps to specific targets (e.g., merge point after a branch)

### 4.4 Validation

Frontend validation before save:
- Branch step must have at least 1 condition
- All targetStepId references must point to existing steps
- No orphan steps (every step must be reachable from step 1)
- Cycle warning (not blocking — loops may be intentional for retry patterns)

---

## Phase 5 — Frontend: Visual Flow Builder (Graph Editor)

**Goal:** Replace the linear step list with a visual drag-and-drop graph editor for building branched flows.

### 5.1 Install React Flow

```bash
npm install @xyflow/react
```

### 5.2 New Component: FlowGraphEditor.tsx

**File:** `frontend/rating-workspace/src/components/flow/FlowGraphEditor.tsx`

- Full visual graph editor using React Flow
- Nodes = steps (styled like current ExecutionFlowDiagram cards)
- Edges = connections between steps (with labels for branch conditions)
- Branch nodes show multiple output handles (one per condition + default)
- Drag to connect steps
- Click node to open step config panel (reuse existing step config forms)
- Auto-layout via Dagre/ELK.js
- Minimap for large flows
- Zoom/pan controls

### 5.3 Replace Step List in ProductDetail.tsx

**File:** `frontend/rating-workspace/src/pages/ProductDetail.tsx`

- Replace the sorted step list + "Insert step here" buttons with `<FlowGraphEditor />`
- Keep the step config panel (right-side edit panel) — triggered by clicking a node
- "Add Step" becomes a toolbar button that creates a new unconnected node
- Drag from node output handle to another node input handle to create connection

### 5.4 Replace Step List in CustomFlowEdit.tsx

**File:** `frontend/rating-workspace/src/pages/CustomFlowEdit.tsx`

- Same FlowGraphEditor component, filtered to allowed custom flow step types

### 5.5 Enhanced ExecutionFlowDiagram.tsx

**File:** `frontend/rating-workspace/src/components/flow/ExecutionFlowDiagram.tsx`

- Replace CSS card layout with React Flow (read-only mode)
- Render the full flow graph from the `/graph` API endpoint
- Highlight executed path (green edges/borders)
- Gray out untaken branches
- Animate execution order (optional — pulse through steps in sequence)
- Branch nodes show which condition was evaluated and result

### 5.6 Enhanced TestingFlowCircles.tsx

Option: Replace with a mini React Flow graph (read-only, compact) OR keep as linear circles showing only executed path. Decision depends on screen real estate in the Test Rating right panel.

---

## Phase 6 — Advanced Features

**Goal:** Production-grade branching with parallel execution, merge points, and loop support.

### 6.1 Parallel Branch Execution

- New step type: `parallel` — executes multiple branches simultaneously
- Config: `{ branches: [{ targetStepId, mergeStepId }] }`
- Execution: `Promise.all()` on branch paths
- Merge step waits for all parallel branches to complete
- Results merged into working context

### 6.2 Loop / Retry Patterns

- Allow `defaultNextStepId` to point to an earlier step (creates a loop)
- Add `maxIterations` config on loop-back edges
- Use case: retry a failed external call up to N times

### 6.3 Sub-Flow Branching

- Branch target can be a `run_custom_flow` step — branch to an entire sub-flow
- Enables modular flow composition (e.g., "D&B Enrichment" as a reusable sub-flow called from a branch)

### 6.4 Flow Versioning

- Version the entire flow graph (not just individual steps)
- Rollback to previous flow version
- Blue/green flow deployment (test new flow on subset of transactions)

---

## Phase 7 — Flow Designer (Templates, Palette & Reusable Blocks)

**Goal:** Make building orchestration flows fast and accessible — pre-defined templates, a drag-and-drop step palette, and custom flows as reusable building blocks.

### 7.0 Dedicated Flow Designer Page

Rather than embedding the designer inside the existing Orchestrator tab, introduce a dedicated **Flow Designer** route:

```
/products/:code/orchestrator/:flowEndpoint/designer
```

- Accessible via a **"Open in Designer"** button on the Orchestrator tab (alongside the existing step list view)
- The existing Orchestrator tab step list, edit pencil, delete trash, and "+ Insert step here" buttons remain **fully intact** — the designer is additive, not a replacement
- Users can switch freely between the list view (for quick edits) and the designer (for visual building)
- Both views read/write the same underlying step data via the same line-rating API

### 7.1 Dynamic Step Palette Sidebar

**File:** `frontend/rating-workspace/src/components/flow/StepPalette.tsx`

A left sidebar on the Flow Designer page. All sections are **populated dynamically from the API** — nothing is hardcoded. Sections collapse/expand independently.

**Section: Step Types**
- Fetched from a new `GET /meta/step-types` endpoint (or derived from the contracts)
- Grouped by category with icons and one-line descriptions

| Category | Step Types |
|---|---|
| **Data** | field_mapping, format_transform |
| **Logic** | apply_rules, branch, validate_request |
| **External** | call_rating_engine, call_orchestrator |
| **Control** | run_custom_flow, respond |

**Section: Custom Flows**
- Fetched from `GET /custom-flows` — all saved custom flows for the product line
- Each entry is draggable → creates a `run_custom_flow` step pre-configured with that flow's ID
- Shows flow name, step count, and last modified date
- "Create new custom flow" shortcut at the bottom

**Section: Mappings**
- Fetched from `GET /mappings` — all saved mappings for the product
- Dragging creates a `field_mapping` step pre-filled with the mapping ID
- Shows mapping name and field count

**Section: Rating Rules**
- Fetched from `GET /rules` — all saved rule sets for the product
- Dragging creates an `apply_rules` step pre-configured with the rule set ID
- Shows rule name, condition count, and scope

**Section: Systems**
- Fetched from `GET /systems` — Guidewire, CGI, Earnix, Duck Creek, Salesforce, etc.
- Dragging creates a `call_rating_engine` step pre-filled with the system config
- Shows system name, type, and connection status badge

**Search bar** at the top of the palette searches across all sections simultaneously.

**Preserved behaviors:**
- Clicking any node on the canvas opens the same config panel used by the list view (step name, config fields, condition expression, active toggle)
- Edit, save, and delete from the canvas call the same API endpoints as the list view
- The existing step list on the Orchestrator tab continues to show all steps with full edit/delete/reorder capability — unchanged

### 7.3 Flow Templates

**New page/modal:** Flow template picker shown when clicking **"+ Add Flow"** on the Orchestrator tab.

Instead of starting with a blank canvas, users choose from pre-built templates:

| Template | Steps Pre-Wired |
|---|---|
| **Guidewire → CGI Ratabase** | Validate → Map Request → JSON-to-XML → Call CGI → XML-to-JSON → Map Response → Post-Rating Rules → Respond |
| **Guidewire → Earnix** | Validate → Map Request → Call Earnix → Map Response → Post-Rating Rules → Respond |
| **D&B Enrichment Branch** | Validate → Branch[has DUNS?] → [YES: Enrich D&B → Map D&B] → Call Engine → Respond |
| **Simple Validation Flow** | Validate → Apply Rules → Respond |
| **Blank** | Empty canvas |

**Implementation:**
- Templates stored as static JSON in `frontend/rating-workspace/src/data/flow-templates.ts`
- Each template defines nodes (step type + default config skeleton) and edges (connections)
- On selection, the template is instantiated — step names are editable, configs need to be filled in
- Backend creates the steps via the existing line-rating API

**File:** `frontend/rating-workspace/src/data/flow-templates.ts`
```typescript
interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;              // lucide-react icon name
  category: 'common' | 'branching' | 'blank';
  nodes: TemplateNode[];     // step type + label + default config skeleton
  edges: TemplateEdge[];     // from/to node indices + label
}
```

### 7.4 Smart Step Suggestions (AI-Assisted)

**File:** `frontend/rating-workspace/src/components/flow/StepSuggestions.tsx`

Leverages the existing AWS Bedrock / AI Prompts infrastructure already in the platform.

When a user adds a step, the system checks for common patterns and surfaces inline suggestions:

- Add "Call CGI Ratabase" → suggest "You likely need a JSON→XML transform before this step"
- Add "field_mapping" after a call_rating_engine → suggest "Consider adding post-rating rules next"
- Add "branch" with no outgoing edges → warn "This branch has no targets configured yet"

Suggestions appear as a dismissable banner above the canvas. One-click to accept inserts the suggested step.

**Backend:** New endpoint on line-rating: `POST /orchestrators/:code/flow/:endpoint/suggest-next-step` — sends current flow graph to Bedrock and returns step type suggestions.

### 7.5 Template Gallery Page (Future)

A dedicated `/flow-templates` page showing the full template library with previews, categories (Commercial Lines, Personal Lines, Specialty), and ability for admins to publish custom flows as templates for the whole org.

---

## Files Changed Per Phase

| Phase | Files | Type |
|-------|-------|------|
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
| **5** | `frontend/rating-workspace/src/components/flow/FlowGraphEditor.tsx` | New |
| **5** | `frontend/rating-workspace/src/components/flow/ExecutionFlowDiagram.tsx` | Rewrite |
| **5** | `frontend/rating-workspace/src/pages/ProductDetail.tsx` | Modify |
| **5** | `frontend/rating-workspace/src/pages/CustomFlowEdit.tsx` | Modify |
| **6** | Multiple backend + frontend files | New + Modify |

---

## Verification

### Phase 1 Verification
1. Create a test orchestrator with steps: Validate → Branch (condition: `working.dunsNumber != null`) → [YES: Enrich D&B → Map D&B] → [NO: skip] → Call Engine → Respond
2. Send rating request WITH dunsNumber → verify D&B steps execute
3. Send rating request WITHOUT dunsNumber → verify D&B steps are skipped, engine called directly
4. Verify existing linear flows (GL product) still work unchanged
5. Run `npx nx run-many -t test` — all existing tests pass
6. Check transaction step logs include `branchDecision` for branch steps

### Phase 3 Verification
1. Open Transactions page → expand a branched transaction → verify flow diagram shows branch badge
2. Open Insights page → same verification
3. Open Test Rating → run a branched flow → verify both TestingFlowCircles and ExecutionFlowDiagram render correctly
4. Click a branch step node → verify StepDetailPanel shows branch decision details

### Phase 4 Verification
1. Open Orchestrator tab for a product → add a `branch` step
2. Configure two conditions with target steps
3. Save and verify step is persisted with correct config
4. Run test from Test Rating → verify branch executes correctly

### Phase 5 Verification
1. Open Orchestrator tab → visual graph editor renders existing linear flow correctly
2. Add a branch node → drag connections to create two paths
3. Verify the flow saves and executes correctly
4. Open Transactions → expanded row shows full graph with highlighted execution path
