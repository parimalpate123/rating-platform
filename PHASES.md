# InsuRatePro — Implementation Phases (Phase 4–8)

> **Status:** Phase 3 COMPLETE. Ready for Phase 4.
> **Date:** February 2026
> **Reference:** `/Users/parimalpatel/code/rating-platform/ARCHITECTURE.md`

---

## Completed Phases Summary

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | Foundation — Nx monorepo, product-config service, rules service, DB schema (18 tables), Docker compose | ✅ Done |
| Phase 2 | Workspace UI — Product landing, ProductDetail page, tab framework, shared package | ✅ Done |
| Phase 3 | MappingsTab (AI/CSV/wizard/field details/edit), RulesTab (CRUD/AI/conditions/actions), ScopesTab, full rules evaluate() engine | ✅ Done |

---

## What Already Exists (from exploration)

### Backend Services (all running)
| Service | Port | Location | Status |
|---------|------|----------|--------|
| core-rating orchestrator | 4000 | `orchestrators/core-rating/` | **Scaffolded** — has ExecutionEngine, StepHandlerRegistry, 5 handlers (FieldMapping, ApplyRules, FormatTransform, CallRatingEngine, PublishEvent), RatingController. Handlers are stubs that make HTTP calls to downstream services. |
| line-rating orchestrator | 4001 | `orchestrators/line-rating/` | **Scaffolded** — has OrchestratorService (CRUD + autoGenerate with XML/JSON templates), OrchestratorController (full REST), entities (ProductOrchestrator, OrchestratorStep). |
| product-config | 4010 | `services/product-config/` | **Complete** — product lines, mappings (with AI/CSV), systems, scopes |
| transform-service | 4011 | `services/transform-service/` | **Scaffolded** — has TransformModule with `POST /transform` endpoint |
| rules-service | 4012 | `services/rules-service/` | **Complete** — full evaluate() with 14 operators, 9 action types, scope filtering |
| status-service | 4013 | `services/status-service/` | **Scaffolded** — has TransactionsModule, TransactionEntity, TransactionStepLogEntity |

### Frontend
| Component | Status |
|-----------|--------|
| OrchestratorTab (in ProductDetail) | **Exists** — renders steps, supports edit/delete/rename, auto-generate button. Calls `orchestratorApi` at `/api/line-rating/orchestrators/:code` |
| orchestrator.ts API client | **Exists** — full CRUD + autoGenerate + reorderSteps + ratingApi.rate() |
| MappingsTab, RulesTab, ScopesTab | **Complete** |

### DB Tables (all in migration 001)
`product_orchestrators`, `orchestrator_steps`, `transactions`, `transaction_step_logs` — all created and ready.

### Shared Contracts
`packages/contracts/src/lib/orchestrator.ts` — defines StepConfig, ExecutionContext, StepResult, OrchestratorStepType (8 types), resilience configs.

---

## Phase 4 — Wire Orchestrator End-to-End

**Goal:** Make the orchestrator actually execute a rating flow. The scaffolding exists — we need to wire real logic into the handlers and connect the UI to trigger execution.

### 4.1 — Line-Rating: Auto-Generate with Mapping Stubs

**File:** `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts`

Currently `autoGenerate()` creates steps but does NOT create empty Mapping entities for `field_mapping` steps. We need:
- When creating a `field_mapping` step, call product-config service to create an empty Mapping entity
- Store the returned `mappingId` in the step's `config.mappingId`
- This way, when users click a field_mapping step, they can immediately start adding fields

**Inter-service call pattern:** HTTP to `http://localhost:4010/api/v1/mappings` (already used by other handlers).

### 4.2 — Transform Service: Real Transformation Engine

**File:** `services/transform-service/src/transform/transform.service.ts`

Port the transformation engine from the old POC:
- **Source:** `~/code/rating-poc/apps/rating-api/src/modules/pipelines/pipeline-execution.service.ts` (`runTransform()` method)
- Fetch mapping + field definitions from product-config service
- Apply each field mapping: `getByPath(source) → transform → setByPath(target)`
- Support all 16 transformation types (direct, multiply, divide, round, lookup, expression, date, etc.)
- Return `{ transformedData, audit: FieldResult[] }`

Also port format adapter:
- **Source:** `~/code/rating-poc/apps/rating-api/src/modules/pipelines/adapters/format.adapter.ts`
- `jsonToXml()`, `xmlToJson()`, `jsonToSoap()`, `soapToJson()`
- Add `POST /transform/format` endpoint

### 4.3 — Core-Rating: Wire Step Handlers

**Files:** `orchestrators/core-rating/src/handlers/*.handler.ts`

Each handler currently exists as a stub. Wire real logic:

| Handler | What to Wire |
|---------|-------------|
| `FieldMappingHandler` | Call transform-service `POST /transform` with `{ mappingId, context }` |
| `ApplyRulesHandler` | Call rules-service `POST /rules/evaluate` with `{ productLineCode, scope, context, phase }` |
| `FormatTransformHandler` | Call transform-service `POST /transform/format` with `{ data, direction }` |
| `CallRatingEngineHandler` | Fetch system config from product-config, make HTTP call (JSON body or XML body based on format) |
| `PublishEventHandler` | Log event for now (Kafka adapter is Phase 6) |

### 4.4 — Core-Rating: Rating Controller

**File:** `orchestrators/core-rating/src/rating/rating.service.ts`

Wire the `rate()` method:
1. Fetch orchestrator definition from line-rating service: `GET /api/v1/orchestrators/:code`
2. Pass steps to ExecutionEngine
3. ExecutionEngine iterates active steps, calls handler for each step type
4. Record results (call status-service for each step)
5. Return `RateResponse` with stepResults and totalDurationMs

### 4.5 — Frontend: Vite Proxy for Orchestrators

**File:** `frontend/rating-workspace/vite.config.ts`

Ensure proxy routes exist:
```
/api/line-rating → http://localhost:4001/api/v1
/api/core-rating → http://localhost:4000/api/v1
```

### 4.6 — Mock Systems

Port from old POC or create fresh mock endpoints in core-rating:
- Mock Earnix: `POST /mock/earnix/rate` → returns JSON premium response
- Mock Ratabase: `POST /mock/ratabase/rate` → returns XML premium response
- These can live in product-config or core-rating as simple controllers

### 4.7 — Verification

1. Create product "GL Test" (target=Earnix, JSON format)
2. Go to Orchestrator tab → click "Auto-Generate Flow" → 5 steps appear
3. Go to Mappings tab → 2 empty mappings created (request + response) linked to orchestrator steps
4. Add field mappings to request mapping
5. Add a pre-rating rule (e.g., "if state=NY, surcharge 10%")
6. Go to Orchestrator tab → click a "Test" button
7. See step-by-step results: fields mapped → rules applied → system called → response mapped

---

## Phase 5 — Status Service & Transaction Monitor

**Goal:** Full transaction tracking with per-step trace, historical dashboard.

### 5.1 — Status Service: Wire Transaction Recording

**Files:** `services/status-service/src/transactions/`

- `POST /transactions` — create transaction record (called by core-rating at start of execution)
- `PUT /transactions/:id` — update status, response, duration (called at end)
- `PUT /transactions/:id/steps/:stepOrder` — record per-step result (called after each step)
- `GET /transactions?productLineCode=X&status=Y` — list with filters
- `GET /transactions/:id` — full detail with step results

### 5.2 — Core-Rating: Record to Status Service

Update `ExecutionEngine` to:
- Call `POST /transactions` before starting execution
- Call `PUT /transactions/:id/steps/:stepOrder` after each step
- Call `PUT /transactions/:id` with final status after completion

### 5.3 — Frontend: Transaction Monitor Page

New page: `/product/:code/transactions`
- Table: transactionId, status badge, scope (state/coverage), premium result, duration, timestamp
- Click row → expand step trace (step name, status, duration, input/output snapshots)
- Filters: status (completed/failed), date range, scope

### 5.4 — Frontend: Test Panel in Orchestrator Tab

Add "Test Rating" section to OrchestratorTab:
- Scope selector: state dropdown, coverage dropdown, transaction type dropdown
- Payload editor: JSON textarea with sample payload
- "Run Test" button → calls `ratingApi.rate(code, payload, scope)`
- Results panel: step-by-step trace with status badges, duration per step, expandable input/output

### 5.5 — Activity Feed

Wire `activity_log` table (already exists in DB):
- Backend: `GET /api/v1/product-lines/:code/activity` (already in product-config)
- Frontend: ActivityFeed component showing recent changes per product

---

## Phase 6 — Adapters & Enrichment

**Goal:** External system adapters (mock implementations for POC).

### 6.1 — Kafka Adapter

New service: `services/adapters/kafka/` (port 3010)
- `POST /publish` — publish event to topic (mock: store in memory/DB)
- `GET /topics` — list topics with message counts
- `GET /topics/:topic/messages` — list recent messages
- Wire `PublishEventHandler` in core-rating to call this adapter

### 6.2 — D&B Adapter

New service: `services/adapters/dnb/` (port 3011)
- `POST /lookup` — mock company lookup by taxId or companyName
- Returns: DUNS number, credit score, risk tier, annual revenue, employee count
- Mock data: 10-20 sample companies
- Wire `CallExternalApiHandler` in core-rating

### 6.3 — GW Adapter

New service: `services/adapters/gw/` (port 3012)
- `POST /rate/initiate` — mock callback to initiate rating
- `POST /rate/complete` — mock callback to deliver result
- `GET /callbacks` — list recent callbacks for inspection

### 6.4 — Enrichment Handler

Wire `EnrichHandler` in core-rating:
- Reads step config: `{ lookups: [{ sourceField, tableKey, targetField }] }`
- Calls product-config service: `GET /lookup-tables/:key/lookup/:value`
- Merges result into execution context

---

## Phase 7 — Resilience & Production Polish

**Goal:** Production-grade error handling, retries, circuit breakers.

### 7.1 — Step Resilience

Add to ExecutionEngine per-step:
- **Timeout**: configurable per step (`config.timeout`), default 30s
- **Retry**: `config.retry: { maxAttempts, backoffMs, multiplier }` with exponential backoff
- **Circuit breaker**: `config.circuitBreaker: { failureThreshold, resetAfterMs }`
- **onFailure**: `stop` (halt pipeline) | `skip` (continue) | `use_default` (use fallback value)

### 7.2 — Conditional Step Execution

Steps can have conditions:
```json
{ "condition": { "field": "context.working.insured.annualRevenue", "operator": "gt", "value": 5000000 } }
```
Skip step if condition not met. Useful for: "Only call D&B for large accounts."

### 7.3 — Orchestrator Versioning

Add `version` column to `product_orchestrators`. When updating a live orchestrator, create a new version. Allow rollback.

### 7.4 — Correlation ID Propagation

Ensure `X-Correlation-ID` header propagated through all inter-service calls. Status service uses it for distributed trace. Add middleware from `packages/shared`.

### 7.5 — End-to-End Integration Test

Full IMCE flow: GW JSON → Map Request → Pre-Rules → JSON→XML → Call Ratabase → XML→JSON → Map Response → Post-Rules → GW JSON. Verify every step traced in status service.

---

## Phase 8 — AWS Deployment

**Goal:** Production deployment on AWS. (See ARCHITECTURE.md Section 17 for full details.)

- **EKS**: core-rating, line-rating, product-config, transform, rules, status (always-on, low-latency)
- **Lambda**: adapters (D&B, GW, Kafka consumer) — infrequent, pay-per-use
- **RDS**: Multi-AZ PostgreSQL
- **MSK**: Amazon Managed Kafka
- **S3**: Knowledge base storage
- **ElastiCache**: Redis caching
- **CloudFront + ALB**: Frontend CDN + API routing
- **CI/CD**: GitHub Actions → ECR → Helm → EKS
- **Observability**: CloudWatch Logs + Metrics, X-Ray distributed tracing, dashboards

---

## Implementation Priority for Phase 4

Since all scaffolding already exists, Phase 4 is primarily **wiring** — connecting the stubs to real services. Estimated parallel work:

**Batch A (parallel):**
- Agent 1: Transform service — real transformation engine + format adapter
- Agent 2: Step handlers in core-rating — wire all 5 handlers to downstream services

**Batch B (after A):**
- Agent 3: Line-rating autoGenerate — create empty mapping stubs + wire to product-config
- Agent 4: Rating controller — wire execute flow + status recording

**Batch C (after B):**
- Agent 5: Frontend — test panel in OrchestratorTab + vite proxy config
- Agent 6: Mock systems controller

**Verification:** Create GL product → auto-generate → add mappings → add rules → execute test → see step trace.
