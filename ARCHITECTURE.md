# InsurRateX — Enterprise Rating Orchestration Framework

> **Version:** 1.0 Draft
> **Date:** February 2026
> **Status:** Architecture Design — Pre-Implementation

---

## Table of Contents

1. [Vision & Overview](#1-vision--overview)
2. [New Line Onboarding Flow](#2-new-line-onboarding-flow)
3. [Runtime Execution Flow](#3-runtime-execution-flow)
4. [Folder Structure](#4-folder-structure)
5. [Microservice Architecture](#5-microservice-architecture)
6. [Orchestrators](#6-orchestrators)
7. [Services (APIs)](#7-services-apis)
8. [Databases](#8-databases)
9. [Packages (Shared Libraries)](#9-packages-shared-libraries)
10. [Frontend Applications](#10-frontend-applications)
11. [Step Handler Plugin Registry](#11-step-handler-plugin-registry)
12. [Adapter Framework](#12-adapter-framework)
13. [Transaction Lifecycle & Status Machine](#13-transaction-lifecycle--status-machine)
14. [Implementation Phases](#14-implementation-phases)
15. [Port Assignments](#15-port-assignments)
16. [Team Ownership](#16-team-ownership)

---

## 1. Vision & Overview

InsurRateX is an **enterprise-grade rating orchestration framework** that enables insurance companies to configure, execute, and monitor rating workflows for any product line (General Liability, Inland Marine, Workers' Comp, etc.) across any combination of source systems (Guidewire, Duck Creek, Salesforce) and rating engines (CGI Ratabase, Earnix, custom).

### Core Principles

| Principle | Description |
|---|---|
| **Product-level orchestration** | Each insurance product line owns its execution flow — different products have different steps |
| **Pluggable architecture** | Every step in the flow can use built-in engines, custom libraries, or external APIs |
| **Nested orchestration** | Orchestrators can call sub-orchestrators for complex multi-step sub-flows |
| **Microservice independence** | Each service is independently deployable, testable, and ownable by a separate team |
| **Configuration over code** | New integrations, new product lines, and new flow steps are added via configuration, not code changes |
| **Full observability** | Every transaction, every step, every field transformation is recorded and traceable |

### Architecture Overview

```
                    ┌─────────────────────────┐
                    │    Frontend (UI Layer)    │
                    │  Workspace UI  │ Admin UI │
                    └────────┬────────────┬────┘
                             │            │
              ┌──────────────▼──┐   ┌─────▼──────────────┐
              │   Orchestrators  │   │  Product Config    │
              │                  │   │     Service        │
              │  core-rating     │   │  (products, maps,  │
              │  line-rating     │   │   systems, scopes) │
              └──┬───┬───┬───┬──┘   └────────────────────┘
                 │   │   │   │
        ┌────────┘   │   │   └────────┐
        ▼            ▼   ▼            ▼
   ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
   │Transform│ │ Rules  │ │ Status │ │ Adapters │
   │ Service │ │Service │ │Service │ │          │
   └─────────┘ └────────┘ └────────┘ │ Kafka    │
                                      │ D&B      │
                                      │ GW       │
                                      └──────────┘
```

---

## 2. New Line Onboarding Flow

When an insurance company wants to onboard a new product line (e.g., Inland Marine Contractor Equipment), this is the step-by-step journey:

### Phase A: Product Setup (Day 1 — one-time)

```
Step 1 │ Create Product Line
       │ Name: "Inland Marine Contractor Equipment"
       │ Code: IMCE
       │ Source System: Guidewire PolicyCenter (JSON)
       │ Rating Engine: CGI Ratabase (XML)
       │ Product Owner: Jane Smith
       │ Technical Lead: John Doe
       │
Step 2 │ System Auto-Generates:
       │ → Line-rating-orchestrator flow for IMCE (8 steps for XML target)
       │ → Empty Request Mapping containers (field_mapping steps)
       │ → Empty Response Mapping container
       │ → Pre-rating & post-rating rule placeholders
       │ → Status tracking configuration
       │
Step 3 │ Preview & Confirm Flow:
       │ "Your IMCE product will follow this execution flow:"
       │
       │  Receive → Map Fields → Construct JSON → Pre-Rules
       │         → JSON→XML → Call Ratabase → XML→JSON
       │         → Map Response → Post-Rules → Send
       │
Step 4 │ Configure Scope (initial):
       │ States: CA, NY (status: In Dev)
       │ Coverages: Contractor Equipment (status: In Dev)
       │ Transaction Types: New Business (status: In Dev)
```

### Phase B: Iterative Sprint Work (Ongoing — weeks/months)

```
Sprint 1:
  → Add field mappings for core Contractor Equipment fields
  → Add pre-rating rule: "CA equipment minimum $5,000"
  → Test: CA + Contractor Equipment + New Business → verify premium
  → Mark: CA + Contractor Equipment = In Testing

Sprint 2:
  → Add NY-specific rules (NY surcharge, state tax)
  → Add additional field mappings for equipment schedules
  → Test: NY + Contractor Equipment + New Business → verify
  → Mark: NY + Contractor Equipment = In Testing

Sprint 3:
  → Add "Renewal" transaction type
  → Add renewal-specific rules (loyalty discount, rate change cap)
  → Test all states × all coverages × renewal
  → Mark: CA = Live, NY = Live (for new business)

Sprint 4:
  → Add D&B enrichment step (call D&B for equipment value verification)
  → Add Kafka event publishing (rating completed event)
  → Test full flow including D&B + Kafka
  → Go live for renewals
```

### Phase C: Go-Live & Monitor

```
  → All scope items marked "Live"
  → Transaction monitor dashboard shows real-time flow
  → Alerts configured for failures, timeouts, SLA breaches
  → Product owner reviews daily transaction summary
```

---

## 3. Runtime Execution Flow

### IMCE — Inland Marine + CGI Ratabase (JSON → XML)

```
GW PolicyCenter                                              CGI Ratabase
     │                                                            │
     │  JSON request                                              │
     ▼                                                            │
┌─────────────────────────────────────────────────────────────────┐
│ LINE-RATING-ORCHESTRATOR (IMCE Flow)                            │
│                                                                  │
│  Step 1: field_mapping    "Map GW Request Fields"               │
│  Step 2: field_mapping    "Construct Rating Engine JSON"        │
│  Step 3: apply_rules      "Pre-Rating Rules" (scope-filtered)  │
│  Step 4: format_transform "JSON → XML"                          │
│  Step 5: call_rating_engine "Call CGI Ratabase" ───────────────►│
│                                                     XML ◄───────│
│  Step 6: format_transform "XML → JSON"                          │
│  Step 7: field_mapping    "Map Response to GW"                  │
│  Step 8: apply_rules      "Post-Rating Rules" (scope-filtered) │
│                                                                  │
│  [Auto] publish_event     → Kafka (rating.completed)            │
│  [Auto] record_status     → Status DB (every step traced)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
     │
     ▼  JSON response
GW PolicyCenter
```

### GL — General Liability + Earnix (JSON → JSON)

```
Step 1: field_mapping     "Map GW Request Fields"
Step 2: apply_rules       "Pre-Rating Rules"
Step 3: call_rating_engine "Call Earnix"
Step 4: field_mapping     "Map Response to GW"
Step 5: apply_rules       "Post-Rating Rules"
```

### With Sub-Orchestrator (D&B Enrichment)

```
IMCE Flow:
  Step 1: field_mapping
  Step 2: call_orchestrator → "Enrichment Orchestrator"
                                  Step 1: call D&B API
                                  Step 2: apply enrichment rules
                                  Step 3: publish enrichment event
                              ← returns enriched context
  Step 3: field_mapping (Construct JSON — now with D&B data)
  Step 4: apply_rules
  ...rest of flow
```

---

## 4. Folder Structure

```
rating-poc/
│
├── frontend/                           ← UI Applications
│   ├── workspace/                      ← Orchestration Framework UI (port 5174)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── ProductLanding.tsx       ← create/select product line
│   │   │   │   ├── ProductHome.tsx          ← flow view + scope + activity
│   │   │   │   └── TransactionMonitor.tsx   ← live transaction dashboard
│   │   │   ├── components/
│   │   │   │   ├── OrchestratorFlow.tsx     ← dynamic step flow visual
│   │   │   │   ├── StepLibrary.tsx          ← browse available step types
│   │   │   │   ├── FieldMappingPanel.tsx    ← inline field editor
│   │   │   │   ├── RulesPanel.tsx           ← rules editor
│   │   │   │   ├── ScopeManager.tsx         ← states/coverages/txn types
│   │   │   │   ├── ConnectionManager.tsx    ← register/test external systems
│   │   │   │   └── ActivityFeed.tsx         ← recent changes
│   │   │   └── contexts/
│   │   │       └── WorkspaceContext.tsx
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── Dockerfile
│   │
│   └── admin/                          ← Config Admin UI (port 5173)
│       ├── src/
│       ├── package.json
│       └── Dockerfile
│
├── orchestrators/                      ← Orchestrator Services
│   ├── core-rating/                    ← Core Rating Orchestrator (port 3001)
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── execution.engine.ts      ← step-by-step executor
│   │   │   │   ├── context.manager.ts       ← execution context lifecycle
│   │   │   │   └── correlation.ts           ← distributed tracing
│   │   │   ├── registry/
│   │   │   │   ├── step-handler.registry.ts ← plugin registry
│   │   │   │   └── adapter.registry.ts      ← external adapter registry
│   │   │   ├── handlers/
│   │   │   │   ├── field-mapping.handler.ts
│   │   │   │   ├── apply-rules.handler.ts
│   │   │   │   ├── format-transform.handler.ts
│   │   │   │   ├── call-rating-engine.handler.ts
│   │   │   │   ├── call-external-api.handler.ts
│   │   │   │   ├── call-orchestrator.handler.ts
│   │   │   │   ├── publish-event.handler.ts
│   │   │   │   └── enrich.handler.ts
│   │   │   ├── resilience/
│   │   │   │   ├── circuit-breaker.ts
│   │   │   │   ├── retry.policy.ts
│   │   │   │   └── timeout.policy.ts
│   │   │   ├── controllers/
│   │   │   │   ├── execution.controller.ts  ← POST /execute, POST /test
│   │   │   │   ├── registry.controller.ts   ← GET /registry
│   │   │   │   └── health.controller.ts     ← GET /health
│   │   │   └── app.module.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── line-rating/                    ← Line Rating Orchestrator (port 3003)
│       ├── src/
│       │   ├── definitions/
│       │   │   ├── orchestrator.service.ts  ← CRUD for flow definitions
│       │   │   ├── auto-generate.service.ts ← auto-create flow based on systems
│       │   │   └── templates/
│       │   │       ├── xml-target.template.ts  ← template for XML-based targets
│       │   │       └── json-target.template.ts ← template for JSON-based targets
│       │   ├── controllers/
│       │   │   └── orchestrator.controller.ts  ← GET/PUT /orchestrators/:code
│       │   ├── entities/
│       │   │   ├── product-orchestrator.entity.ts
│       │   │   └── orchestrator-step.entity.ts
│       │   └── app.module.ts
│       ├── package.json
│       └── Dockerfile
│
├── services/                           ← Supporting Microservices
│   ├── product-config/                 ← Product Configuration Service (port 3002)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── product-lines/      ← product line CRUD + scopes
│   │   │   │   ├── mappings/           ← mapping CRUD + field mappings
│   │   │   │   ├── systems/            ← system registry
│   │   │   │   ├── lookup-tables/      ← lookup table CRUD
│   │   │   │   ├── decision-tables/    ← decision table CRUD
│   │   │   │   ├── knowledge-base/     ← document storage (S3)
│   │   │   │   ├── scopes/             ← scope management
│   │   │   │   ├── scope-tags/         ← entity scope tagging
│   │   │   │   └── activity-log/       ← activity tracking
│   │   │   ├── entities/               ← all config entities
│   │   │   └── app.module.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── transform/                      ← Transformation Service (port 3004)
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── transformation.engine.ts  ← field mapping execution
│   │   │   │   └── expression.evaluator.ts   ← safe expression eval
│   │   │   ├── adapters/
│   │   │   │   ├── format.adapter.ts         ← JSON↔XML↔SOAP conversion
│   │   │   │   └── xslt.adapter.ts           ← future: XSLT support
│   │   │   ├── controllers/
│   │   │   │   └── transform.controller.ts   ← POST /transform
│   │   │   └── app.module.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── rules/                          ← Rules Engine Service (port 3005)
│   │   ├── src/
│   │   │   ├── engine/
│   │   │   │   ├── rules.evaluator.ts        ← condition evaluation
│   │   │   │   └── action.executor.ts        ← action execution
│   │   │   ├── modules/
│   │   │   │   ├── rules/                    ← rules CRUD
│   │   │   │   └── scope-filter/             ← scope-based rule filtering
│   │   │   ├── controllers/
│   │   │   │   ├── rules.controller.ts       ← CRUD endpoints
│   │   │   │   └── evaluate.controller.ts    ← POST /evaluate
│   │   │   └── app.module.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── status/                         ← Status & Audit Service (port 3006)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── transactions/             ← transaction record CRUD
│   │   │   │   ├── audit/                    ← audit trail
│   │   │   │   └── dashboard/                ← aggregated metrics
│   │   │   ├── controllers/
│   │   │   │   ├── transactions.controller.ts  ← GET/POST /transactions
│   │   │   │   └── dashboard.controller.ts     ← GET /dashboard
│   │   │   └── app.module.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── adapters/                       ← Integration Adapters
│       ├── kafka/                      ← Kafka Adapter (port 3010)
│       │   ├── src/
│       │   │   ├── publisher.service.ts
│       │   │   ├── consumer.service.ts       ← for mock: view published msgs
│       │   │   └── app.module.ts
│       │   ├── package.json
│       │   └── Dockerfile
│       │
│       ├── dnb/                        ← D&B Adapter (port 3011)
│       │   ├── src/
│       │   │   ├── dnb.service.ts            ← call D&B API (or mock)
│       │   │   ├── mock-data/                ← mock company data
│       │   │   └── app.module.ts
│       │   ├── package.json
│       │   └── Dockerfile
│       │
│       └── gw/                         ← Guidewire Adapter (port 3012)
│           ├── src/
│           │   ├── gw-callback.service.ts    ← initiate rate in GW
│           │   ├── mock-server/              ← mock GW endpoint
│           │   └── app.module.ts
│           ├── package.json
│           └── Dockerfile
│
├── packages/                           ← Shared Libraries
│   ├── contracts/                      ← API Contracts (source of truth)
│   │   ├── orchestrator.contract.ts
│   │   ├── transform.contract.ts
│   │   ├── rules.contract.ts
│   │   ├── status.contract.ts
│   │   ├── product-config.contract.ts
│   │   └── adapter.contract.ts
│   │
│   └── shared/                         ← Common Utilities
│       ├── src/
│       │   ├── logger.ts                    ← structured logging
│       │   ├── correlation.ts               ← correlation ID propagation
│       │   ├── error-handling.ts            ← standard error types
│       │   ├── health-check.ts              ← health check utilities
│       │   └── types/                       ← shared TypeScript types
│       └── package.json
│
├── db/                                 ← Database Migrations (per service)
│   ├── core-rating/
│   │   └── migrations/
│   ├── line-rating/
│   │   └── migrations/
│   │       └── 001_orchestrators_and_steps.sql
│   ├── product-config/
│   │   └── migrations/
│   │       ├── 001_product_lines.sql
│   │       ├── 002_mappings.sql
│   │       ├── 003_systems.sql
│   │       ├── 004_scopes.sql
│   │       └── 005_activity_log.sql
│   ├── rules/
│   │   └── migrations/
│   │       └── 001_rules_conditions_actions.sql
│   └── status/
│       └── migrations/
│           └── 001_transaction_records.sql
│
├── docker-compose.yml                  ← local dev: all services + infra
├── docker-compose.infra.yml            ← infra only: postgres, redis, minio, kafka-mock
├── nx.json                             ← Nx monorepo configuration
├── package.json                        ← root package.json
├── tsconfig.base.json                  ← shared TS config
└── ARCHITECTURE.md                     ← this document
```

---

## 5. Microservice Architecture

### Service Communication

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SYNCHRONOUS (HTTP/REST)                          │
│                                                                          │
│  Workspace UI ──► core-rating-orchestrator ──► transform service        │
│  Workspace UI ──► line-rating-orchestrator     ──► rules service        │
│  Workspace UI ──► product-config service       ──► adapters (D&B, GW)  │
│  Admin UI     ──► product-config service       ──► sub-orchestrators   │
│                                                                          │
│  core-rating  ──► line-rating (fetch flow definition)                   │
│  core-rating  ──► product-config (fetch mapping/system config)          │
│  transform    ──► rules service (field-level validation)                │
│  transform    ──► product-config (fetch mapping definitions)            │
│  rules        ──► product-config (fetch rule definitions + scope tags)  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       ASYNCHRONOUS (Kafka Events)                       │
│                                                                          │
│  core-rating  ──► kafka ──► status service  (transaction.started)       │
│  core-rating  ──► kafka ──► status service  (step.completed)            │
│  core-rating  ──► kafka ──► status service  (transaction.completed)     │
│  rules        ──► kafka ──► status service  (rules.evaluated)           │
│  transform    ──► kafka ──► status service  (transform.completed)       │
│  Any service  ──► kafka ──► any subscriber  (custom events)             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cross-Cutting Concerns

Every service includes:

| Concern | How |
|---|---|
| **Correlation ID** | `X-Correlation-ID` header propagated through all service calls. Status service uses it for distributed trace. |
| **Structured Logging** | JSON logs with correlationId, serviceName, timestamp, level. Shared from `packages/shared/logger.ts`. |
| **Health Check** | `GET /health` endpoint on every service. Core-rating aggregates all service health. |
| **Error Handling** | Standard error envelope: `{ error: { code, message, correlationId, service, timestamp } }`. |
| **Auth** | JWT-based service-to-service auth (shared middleware from `packages/shared`). |

---

## 6. Orchestrators

### 6.1 Core Rating Orchestrator (`orchestrators/core-rating/`)

**Port:** 3001
**Owner:** Platform Team
**Responsibility:** The execution engine. Receives a request, loads the flow definition, executes each step through the handler registry, manages transaction lifecycle.

**API Endpoints:**

```
POST /api/v1/execute/{productLineCode}
  → Execute the orchestrator for the given product line
  → Body: { payload, scope: { state, coverage, transactionType } }
  → Returns: { transactionId, status, result, stepTrace[], durationMs }

POST /api/v1/test/{productLineCode}
  → Same as execute but with mock mode (external calls return mock responses)
  → Body: { payload, scope, mockOverrides?: { [stepId]: mockResponse } }

GET /api/v1/transactions
  → List transactions with filters (productLine, status, dateRange)

GET /api/v1/transactions/{id}
  → Full transaction detail with step-by-step trace

GET /api/v1/registry/handlers
  → List all registered step handler types

GET /api/v1/registry/adapters
  → List all registered external adapters with health status

GET /api/v1/health
  → Aggregated health: this service + all downstream services
```

**Step Handler Registry:**

```typescript
interface StepHandler {
  type: string;                     // e.g. "field_mapping"
  execute(context: ExecutionContext, stepConfig: StepConfig): Promise<StepResult>;
  validate(stepConfig: StepConfig): ValidationResult;
  healthCheck?(): Promise<boolean>;
}

// Registry
class StepHandlerRegistry {
  register(handler: StepHandler): void;
  get(type: string): StepHandler;
  list(): StepHandlerInfo[];
}
```

### 6.2 Line Rating Orchestrator (`orchestrators/line-rating/`)

**Port:** 3003
**Owner:** Insurance Line Teams
**Responsibility:** Manages orchestrator flow DEFINITIONS per product line. Does not execute — hands off to core-rating for execution.

**API Endpoints:**

```
GET /api/v1/orchestrators/{productLineCode}
  → Get the flow definition (steps, config, status)

POST /api/v1/orchestrators/{productLineCode}
  → Create a new orchestrator (or auto-generate from template)

PUT /api/v1/orchestrators/{productLineCode}
  → Update orchestrator metadata (name, status)

GET /api/v1/orchestrators/{productLineCode}/steps
  → List all steps in order

POST /api/v1/orchestrators/{productLineCode}/steps
  → Add a new step

PUT /api/v1/orchestrators/{productLineCode}/steps/{stepId}
  → Update a step (config, name, order, isActive)

DELETE /api/v1/orchestrators/{productLineCode}/steps/{stepId}
  → Remove a step

POST /api/v1/orchestrators/{productLineCode}/auto-generate
  → Auto-generate flow from template based on source/target system formats

GET /api/v1/templates
  → List available flow templates (xml-target, json-target, custom)
```

**Auto-Generation Templates:**

| Template | When | Steps Generated |
|---|---|---|
| `xml-target` | Target system format = XML/SOAP | 8 steps (with format_transform) |
| `json-target` | Target system format = JSON | 5 steps (no format_transform) |
| Custom | User builds manually | Start with empty flow |

---

## 7. Services (APIs)

### 7.1 Product Config Service (`services/product-config/`)

**Port:** 3002
**Owner:** Config Team
**Database:** product_config_db

**API Endpoints:**

```
── Product Lines ─────────────────────────
GET    /api/v1/product-lines
POST   /api/v1/product-lines
GET    /api/v1/product-lines/{code}
PUT    /api/v1/product-lines/{code}
DELETE /api/v1/product-lines/{code}

── Scopes ────────────────────────────────
GET    /api/v1/product-lines/{code}/scopes
POST   /api/v1/product-lines/{code}/scopes
PUT    /api/v1/product-lines/{code}/scopes/{id}
DELETE /api/v1/product-lines/{code}/scopes/{id}

── Mappings ──────────────────────────────
GET    /api/v1/mappings?productLineCode={code}
POST   /api/v1/mappings
GET    /api/v1/mappings/{id}
PUT    /api/v1/mappings/{id}
DELETE /api/v1/mappings/{id}

── Field Mappings ────────────────────────
GET    /api/v1/mappings/{id}/fields
POST   /api/v1/mappings/{id}/fields
PUT    /api/v1/mappings/{id}/fields/{fieldId}
DELETE /api/v1/mappings/{id}/fields/{fieldId}

── Systems Registry ──────────────────────
GET    /api/v1/systems
POST   /api/v1/systems
GET    /api/v1/systems/{id}
PUT    /api/v1/systems/{id}
DELETE /api/v1/systems/{id}
POST   /api/v1/systems/{id}/health-check

── Lookup Tables ─────────────────────────
GET    /api/v1/lookup-tables
POST   /api/v1/lookup-tables
GET    /api/v1/lookup-tables/{id}/entries
POST   /api/v1/lookup-tables/{id}/entries
GET    /api/v1/lookup-tables/{id}/lookup/{key}

── Decision Tables ───────────────────────
GET    /api/v1/decision-tables
POST   /api/v1/decision-tables
POST   /api/v1/decision-tables/{id}/evaluate

── Knowledge Base ────────────────────────
GET    /api/v1/knowledge-base
POST   /api/v1/knowledge-base/upload
GET    /api/v1/knowledge-base/{id}/download-url
POST   /api/v1/knowledge-base/search

── Activity Log ──────────────────────────
GET    /api/v1/product-lines/{code}/activity
```

### 7.2 Transform Service (`services/transform/`)

**Port:** 3004
**Owner:** Core Team
**Database:** None (stateless — reads config from product-config service)

**API Endpoints:**

```
POST /api/v1/transform
  → Execute field mapping transformation
  → Body: { mappingId, context, options?: { direction, includeAudit } }
  → Returns: { transformedData, audit: FieldResult[] }

POST /api/v1/transform/format
  → Format conversion (JSON↔XML↔SOAP)
  → Body: { data, direction: "json_to_xml"|"xml_to_json"|"json_to_soap"|"soap_to_json", options?: { rootElement } }
  → Returns: { converted: string|object }

POST /api/v1/transform/batch
  → Transform multiple mappings in sequence
  → Body: { mappingIds: string[], context }
  → Returns: { transformedData, audits: FieldResult[][] }

GET /api/v1/transform/types
  → List all supported transformation types (direct, lookup, expression, etc.)
```

**Transformation Types (16):**

| Type | Config | Example |
|---|---|---|
| `direct` | — | Copy as-is |
| `expression` | `{ expression: "value / 1000" }` | Arithmetic |
| `conditional` | `{ condition, trueValue, falseValue }` | If/else |
| `lookup` | `{ tableKey, notFoundValue }` | Table lookup |
| `concat` | `{ fields, separator }` | Join strings |
| `split` | `{ delimiter, index }` | Split string |
| `static` | `{ value }` | Fixed value |
| `uppercase` | — | To uppercase |
| `lowercase` | — | To lowercase |
| `trim` | — | Strip whitespace |
| `number` | — | Parse to number |
| `date` | `{ outputFormat }` | Date format |
| `multiply` | `{ factor }` | Multiply by factor |
| `divide` | `{ divisor }` | Divide by divisor |
| `round` | `{ decimals }` | Round to N places |
| `per_unit` | `{ unitSize }` | Divide by unit (e.g., per $100) |

### 7.3 Rules Service (`services/rules/`)

**Port:** 3005
**Owner:** Business Logic Team
**Database:** rules_db

**API Endpoints:**

```
── Rule CRUD ─────────────────────────────
GET    /api/v1/rules?productLineCode={code}
POST   /api/v1/rules
GET    /api/v1/rules/{id}
PUT    /api/v1/rules/{id}
DELETE /api/v1/rules/{id}

── Rule Conditions & Actions ─────────────
GET    /api/v1/rules/{id}/conditions
POST   /api/v1/rules/{id}/conditions
GET    /api/v1/rules/{id}/actions
POST   /api/v1/rules/{id}/actions

── Scope Tags ────────────────────────────
GET    /api/v1/rules/{id}/scope-tags
POST   /api/v1/rules/{id}/scope-tags
DELETE /api/v1/rules/{id}/scope-tags/{tagId}

── Evaluation ────────────────────────────
POST /api/v1/evaluate
  → Evaluate rules against a context
  → Body: { productLineCode, scope: { state, coverage, transactionType }, context, phase: "pre_rating"|"post_rating" }
  → Returns: { enrichedContext, rulesApplied: RuleResult[], rulesSkipped: string[] }

POST /api/v1/evaluate/test
  → Dry run — evaluate but don't apply actions, show what would happen
```

**Rule Scope Filtering Logic:**

```
Given: productLineCode=IMCE, scope={ state: "CA", coverage: "BOP", txnType: "new_business" }

1. Fetch all active rules for IMCE
2. For each rule, check scope tags:
   - Rule tagged "state=CA" → matches (apply)
   - Rule tagged "state=NY" → does not match (skip)
   - Rule tagged "coverage=BOP" → matches (apply)
   - Rule with no scope tags → applies to ALL (universal rule)
3. Evaluate matched rules in priority order
4. Apply actions to context
```

### 7.4 Status Service (`services/status/`)

**Port:** 3006
**Owner:** Observability Team
**Database:** status_db

**API Endpoints:**

```
── Transaction Records ───────────────────
POST   /api/v1/transactions
  → Create new transaction record (called by orchestrator at start)
  → Body: { productLineCode, orchestratorId, scope, requestPayload, transactionType: "live"|"test" }
  → Returns: { transactionId }

PUT    /api/v1/transactions/{id}
  → Update transaction (status, step results, response, duration)

PUT    /api/v1/transactions/{id}/steps/{stepOrder}
  → Record individual step result (called after each step)
  → Body: { stepType, stepName, status, input, output, durationMs, error? }

GET    /api/v1/transactions
  → List with filters: productLine, status, dateRange, transactionType
  → Supports pagination

GET    /api/v1/transactions/{id}
  → Full detail: metadata + all step results + input/output

── Dashboard ─────────────────────────────
GET    /api/v1/dashboard/summary
  → Aggregated metrics: total transactions, success rate, avg duration by product line

GET    /api/v1/dashboard/product/{productLineCode}
  → Product-specific: transactions by status, scope breakdown, top errors

GET    /api/v1/dashboard/health
  → System-wide: service health, adapter health, error rates
```

### 7.5 Adapters

#### Kafka Adapter (`services/adapters/kafka/`)

**Port:** 3010

```
POST /api/v1/publish
  → Publish event to topic
  → Body: { topic, key?, message, headers? }

GET  /api/v1/topics
  → List topics with message counts

GET  /api/v1/topics/{topic}/messages
  → List recent messages (for mock inspection)
```

#### D&B Adapter (`services/adapters/dnb/`)

**Port:** 3011

```
POST /api/v1/lookup
  → Look up company data
  → Body: { taxId } or { companyName, state }
  → Returns: { dunsNumber, creditScore, riskTier, annualRevenue, employeeCount, ... }

GET  /api/v1/companies/{dunsNumber}
  → Get full company profile
```

#### GW Adapter (`services/adapters/gw/`)

**Port:** 3012

```
POST /api/v1/rate/initiate
  → Callback to GW to initiate rating
  → Body: { policyNumber, effectiveDate, ... }

POST /api/v1/rate/complete
  → Callback to GW to deliver rating result
  → Body: { policyNumber, premium, ... }

GET  /api/v1/callbacks
  → List recent callbacks (for mock inspection)
```

---

## 8. Databases

### Database-Per-Service Strategy

Each service owns its data. No cross-service table access. Services communicate only via APIs or events.

**For POC:** All services share one Postgres instance but use separate schemas.
**For Production:** Each service gets its own Postgres instance/cluster.

### 8.1 Line Rating DB (`db/line-rating/`)

```sql
-- Orchestrator flow definitions
CREATE TABLE product_orchestrators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  version           VARCHAR(20) DEFAULT '1.0.0',
  status            VARCHAR(20) DEFAULT 'draft',  -- draft, active, archived
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Steps within an orchestrator
CREATE TABLE orchestrator_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestrator_id UUID NOT NULL REFERENCES product_orchestrators(id) ON DELETE CASCADE,
  step_order      INT NOT NULL,
  step_type       VARCHAR(50) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  config          JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(orchestrator_id, step_order)
);
```

**Step config JSONB structures:**

```jsonc
// field_mapping
{ "mappingId": "uuid", "direction": "request", "implementationType": "built_in" }

// apply_rules
{ "scope": "pre_rating", "implementationType": "built_in" }

// format_transform
{ "direction": "json_to_xml", "implementationType": "built_in" }

// call_rating_engine
{ "systemCode": "ratabase-mock", "timeout": 30000, "retry": { "maxAttempts": 3 } }

// call_external_api
{ "systemCode": "dnb-service", "method": "POST", "path": "/lookup", "timeout": 10000 }

// call_orchestrator
{ "orchestratorCode": "enrichment-orchestrator", "inputMapping": {}, "outputMapping": {} }

// publish_event
{ "brokerCode": "kafka-mock", "topic": "rating.completed", "messageTemplate": {} }

// enrich
{ "lookups": [{ "sourceField": "state", "tableKey": "state-factors", "targetField": "stateFactor" }] }
```

### 8.2 Product Config DB (`db/product-config/`)

```sql
-- Product line configurations
CREATE TABLE product_line_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50) UNIQUE NOT NULL,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  config            JSONB DEFAULT '{}',
  status            VARCHAR(20) DEFAULT 'draft',
  version           VARCHAR(20) DEFAULT '1.0.0',
  product_owner     VARCHAR(100),
  technical_lead    VARCHAR(100),
  parent_template_id UUID,
  is_template       BOOLEAN DEFAULT false,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  created_by        VARCHAR(100),
  updated_by        VARCHAR(100)
);

-- Scope items per product
CREATE TABLE product_scopes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL,
  scope_type        VARCHAR(50) NOT NULL,     -- 'state', 'coverage', 'transaction_type'
  scope_value       VARCHAR(100) NOT NULL,    -- 'CA', 'BOP', 'new_business'
  display_name      VARCHAR(255),
  status            VARCHAR(20) DEFAULT 'not_started', -- not_started, in_dev, in_testing, live
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_line_code, scope_type, scope_value)
);

-- Field mappings (mapping container)
CREATE TABLE mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  product_line_code VARCHAR(50),
  version           VARCHAR(20) DEFAULT '1.0.0',
  status            VARCHAR(20) DEFAULT 'draft',
  direction         VARCHAR(10) DEFAULT 'request',  -- 'request', 'response'
  description       TEXT,
  creation_method   VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Individual field mapping rules
CREATE TABLE field_mappings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id            UUID NOT NULL REFERENCES mappings(id) ON DELETE CASCADE,
  source_path           VARCHAR(500) NOT NULL,
  target_path           VARCHAR(500) NOT NULL,
  transformation_type   VARCHAR(50) DEFAULT 'direct',
  transformation_config JSONB DEFAULT '{}',
  data_type             VARCHAR(20) DEFAULT 'string',
  is_required           BOOLEAN DEFAULT false,
  default_value         TEXT,
  field_direction       VARCHAR(10) DEFAULT 'both',     -- 'input', 'output', 'both'
  skip_mapping          BOOLEAN DEFAULT false,
  skip_behavior         VARCHAR(20) DEFAULT 'exclude',  -- 'exclude', 'use_default'
  description           TEXT,
  sample_input          TEXT,
  sample_output         TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- External systems registry
CREATE TABLE systems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  type        VARCHAR(20) DEFAULT 'target',   -- 'source', 'target', 'both', 'adapter'
  protocol    VARCHAR(20) DEFAULT 'rest',      -- 'rest', 'soap', 'grpc', 'kafka', 'mock'
  format      VARCHAR(10) DEFAULT 'json',      -- 'json', 'xml', 'soap', 'binary'
  base_url    TEXT,
  auth_config JSONB DEFAULT '{}',
  headers     JSONB DEFAULT '{}',
  is_mock     BOOLEAN DEFAULT false,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Lookup tables
CREATE TABLE lookup_tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) UNIQUE NOT NULL,
  description   TEXT,
  product_line  VARCHAR(100),
  status        VARCHAR(20) DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lookup_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_table_id UUID NOT NULL REFERENCES lookup_tables(id) ON DELETE CASCADE,
  key             VARCHAR(255) NOT NULL,
  value           JSONB NOT NULL,
  description     TEXT,
  UNIQUE(lookup_table_id, key)
);

-- Activity log
CREATE TABLE activity_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL,
  entity_type       VARCHAR(50) NOT NULL,
  entity_id         UUID,
  action            VARCHAR(50) NOT NULL,
  description       TEXT,
  user_name         VARCHAR(100),
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW()
);
```

### 8.3 Rules DB (`db/rules/`)

```sql
-- Business rules
CREATE TABLE conditional_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  product_line_code VARCHAR(50) NOT NULL,
  status            VARCHAR(20) DEFAULT 'draft',
  version           VARCHAR(20) DEFAULT '1.0.0',
  priority          INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Rule conditions (IF)
CREATE TABLE rule_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES conditional_rules(id) ON DELETE CASCADE,
  field_path      VARCHAR(500) NOT NULL,
  operator        VARCHAR(20) NOT NULL,       -- 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'contains'
  value           JSONB NOT NULL,
  condition_order INT DEFAULT 0
);

-- Rule actions (THEN)
CREATE TABLE rule_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id       UUID NOT NULL REFERENCES conditional_rules(id) ON DELETE CASCADE,
  action_type   VARCHAR(50) NOT NULL,         -- 'set_value', 'multiply', 'add', 'reject', 'flag'
  target_field  VARCHAR(500) NOT NULL,
  value         JSONB NOT NULL,
  action_order  INT DEFAULT 0
);

-- Scope tags on rules
CREATE TABLE rule_scope_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id     UUID NOT NULL REFERENCES conditional_rules(id) ON DELETE CASCADE,
  scope_type  VARCHAR(50) NOT NULL,           -- 'state', 'coverage', 'transaction_type'
  scope_value VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(rule_id, scope_type, scope_value)
);
```

### 8.4 Status DB (`db/status/`)

```sql
-- Every orchestrator execution (live + test)
CREATE TABLE transaction_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id    UUID NOT NULL,
  product_line_code VARCHAR(50) NOT NULL,
  orchestrator_id   UUID NOT NULL,
  transaction_type  VARCHAR(20) NOT NULL,     -- 'live', 'test'
  status            VARCHAR(20) NOT NULL,     -- 'received', 'processing', 'completed', 'failed'
  scope_state       VARCHAR(20),
  scope_coverage    VARCHAR(100),
  scope_txn_type    VARCHAR(50),
  request_payload   JSONB,
  response_payload  JSONB,
  premium_result    DECIMAL(15,2),
  error_message     TEXT,
  started_at        TIMESTAMP DEFAULT NOW(),
  completed_at      TIMESTAMP,
  duration_ms       INT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Step-level results within a transaction
CREATE TABLE transaction_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transaction_records(id) ON DELETE CASCADE,
  step_order      INT NOT NULL,
  step_type       VARCHAR(50) NOT NULL,
  step_name       VARCHAR(255) NOT NULL,
  status          VARCHAR(20) NOT NULL,       -- 'pending', 'running', 'completed', 'failed', 'skipped'
  input_snapshot  JSONB,
  output_snapshot JSONB,
  duration_ms     INT,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',         -- rules applied, fields mapped, etc.
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_txn_product ON transaction_records(product_line_code);
CREATE INDEX idx_txn_status ON transaction_records(status);
CREATE INDEX idx_txn_correlation ON transaction_records(correlation_id);
CREATE INDEX idx_txn_steps_txn ON transaction_steps(transaction_id);
```

---

## 9. Packages (Shared Libraries)

### 9.1 `packages/contracts/` — API Contracts

TypeScript interfaces defining the API contract between services. Each service implements these. Services can mock other services using the contract during development.

```typescript
// orchestrator.contract.ts
export interface ExecuteRequest {
  payload: Record<string, any>;
  scope: { state?: string; coverage?: string; transactionType?: string };
  options?: { mockMode?: boolean; mockOverrides?: Record<string, any> };
}

export interface ExecuteResponse {
  transactionId: string;
  status: 'completed' | 'failed';
  result: Record<string, any>;
  premium?: number;
  stepTrace: StepTraceItem[];
  durationMs: number;
}

export interface StepTraceItem {
  stepOrder: number;
  stepType: string;
  stepName: string;
  status: 'completed' | 'failed' | 'skipped';
  durationMs: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  metadata?: Record<string, any>;
}

// transform.contract.ts
export interface TransformRequest {
  mappingId: string;
  context: Record<string, any>;
  options?: { direction?: 'request' | 'response'; includeAudit?: boolean };
}

export interface TransformResponse {
  transformedData: Record<string, any>;
  audit?: FieldResult[];
}

export interface FieldResult {
  sourcePath: string;
  targetPath: string;
  status: 'success' | 'error' | 'skipped' | 'default';
  sourceValue: any;
  transformedValue: any;
  error?: string;
}

// rules.contract.ts
export interface EvaluateRequest {
  productLineCode: string;
  scope: { state?: string; coverage?: string; transactionType?: string };
  context: Record<string, any>;
  phase: 'pre_rating' | 'post_rating';
}

export interface EvaluateResponse {
  enrichedContext: Record<string, any>;
  rulesApplied: RuleResult[];
  rulesSkipped: string[];
}

// status.contract.ts
export interface CreateTransactionRequest {
  productLineCode: string;
  orchestratorId: string;
  scope: { state?: string; coverage?: string; transactionType?: string };
  requestPayload: Record<string, any>;
  transactionType: 'live' | 'test';
  correlationId: string;
}

// adapter.contract.ts
export interface AdapterRequest {
  systemCode: string;
  method: string;
  path?: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface AdapterResponse {
  statusCode: number;
  data: Record<string, any>;
  headers: Record<string, string>;
  durationMs: number;
}
```

### 9.2 `packages/shared/` — Common Utilities

```typescript
// logger.ts — structured JSON logging
export const createLogger = (serviceName: string) => ({
  info: (message: string, meta?: Record<string, any>) => { ... },
  error: (message: string, error?: Error, meta?: Record<string, any>) => { ... },
  warn: (message: string, meta?: Record<string, any>) => { ... },
});

// correlation.ts — correlation ID propagation
export const correlationMiddleware = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuid();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
};

// error-handling.ts — standard error envelope
export class ServiceError extends Error {
  constructor(public code: string, message: string, public statusCode: number) { ... }
}

// health-check.ts — health check endpoint helper
export const healthCheck = (dependencies: { name: string; check: () => Promise<boolean> }[]) => { ... };
```

---

## 10. Frontend Applications

### 10.1 Workspace UI (`frontend/workspace/` — Port 5174)

The orchestration framework UI. Primary interface for implementation teams.

**Pages:**

| Page | URL | Purpose |
|---|---|---|
| Product Landing | `/` | Create new product or select existing |
| Product Home | `/product/{code}` | Flow view, scope, activity, pipeline |
| Transaction Monitor | `/product/{code}/transactions` | Live + historical transaction list |
| Transaction Detail | `/product/{code}/transactions/{id}` | Step-by-step trace view |
| Step Library | `/product/{code}/steps` | Browse + add step types to flow |
| Connection Manager | `/connections` | Register + health-check external systems |

**Key Components:**

| Component | Purpose |
|---|---|
| `OrchestratorFlow` | Dynamic step visualization (renders from orchestrator definition) |
| `FieldMappingPanel` | Inline field-by-field mapping editor |
| `RulesPanel` | Rules list + editor (conditions → actions) |
| `ScopeManager` | States, coverages, transaction types with status lifecycle |
| `StepLibrary` | Browse registered step types, drag into flow |
| `ConnectionManager` | System registry with health check |
| `TransactionMonitor` | Real-time transaction dashboard |
| `TestPanel` | Scope selector + payload editor + step-by-step trace |
| `ActivityFeed` | Recent changes per product line |

### 10.2 Admin UI (`frontend/admin/` — Port 5173)

Configuration admin interface. Used by config/admin team for detailed editing.

Existing pages stay: Mappings, Rules, Decision Tables, Lookup Tables, Knowledge Base, Systems, Pipelines (legacy).

---

## 11. Step Handler Plugin Registry

The core-rating-orchestrator maintains a registry of all available step handlers. New integrations are added by registering a new handler — no core code changes.

### Built-in Handlers

| Handler | Step Type | Calls | Description |
|---|---|---|---|
| `FieldMappingHandler` | `field_mapping` | Transform Service | Execute field mapping transformation |
| `ApplyRulesHandler` | `apply_rules` | Rules Service | Evaluate scope-filtered business rules |
| `FormatTransformHandler` | `format_transform` | Transform Service | JSON↔XML↔SOAP conversion |
| `CallRatingEngineHandler` | `call_rating_engine` | External (Ratabase/Earnix) | Primary rating engine call |
| `CallExternalApiHandler` | `call_external_api` | Any registered system | Generic HTTP call to any external API |
| `CallOrchestratorHandler` | `call_orchestrator` | Core Rating Orchestrator (self) | Invoke a sub-orchestrator |
| `PublishEventHandler` | `publish_event` | Kafka Adapter | Publish event to message broker |
| `EnrichHandler` | `enrich` | Product Config Service | Internal lookup table enrichment |

### Handler Interface

```typescript
export interface StepHandler {
  /** Unique handler type identifier */
  readonly type: string;

  /** Execute the step, transforming the context */
  execute(context: ExecutionContext, config: StepConfig): Promise<StepResult>;

  /** Validate step configuration before execution */
  validate(config: StepConfig): ValidationResult;

  /** Optional health check for handlers that call external systems */
  healthCheck?(): Promise<HealthStatus>;
}

export interface ExecutionContext {
  correlationId: string;
  transactionId: string;
  productLineCode: string;
  scope: { state?: string; coverage?: string; transactionType?: string };
  request: Record<string, any>;       // original incoming payload
  working: Record<string, any>;       // current working data (mutated by steps)
  enrichments: Record<string, any>;   // data added by enrichment/external steps
  response: Record<string, any>;      // rating engine response (populated by call_rating_engine)
  metadata: {
    stepResults: StepResult[];
    startedAt: Date;
    currentStep: number;
  };
}

export interface StepResult {
  status: 'completed' | 'failed' | 'skipped';
  output?: Record<string, any>;
  error?: string;
  durationMs: number;
  metadata?: Record<string, any>;     // rules applied, fields mapped, etc.
}
```

### Registering a Custom Handler

```typescript
// Example: Custom XSLT transformation handler
class XsltTransformHandler implements StepHandler {
  readonly type = 'xslt_transform';

  async execute(context: ExecutionContext, config: StepConfig): Promise<StepResult> {
    const { xsltFilePath, inputPath, outputPath } = config;
    // Apply XSLT transformation
    const result = await this.xsltEngine.transform(context.working, xsltFilePath);
    context.working = result;
    return { status: 'completed', output: result, durationMs: 42 };
  }

  validate(config: StepConfig): ValidationResult {
    if (!config.xsltFilePath) return { valid: false, error: 'xsltFilePath required' };
    return { valid: true };
  }
}

// Register in the step handler registry
registry.register(new XsltTransformHandler());
```

---

## 12. Adapter Framework

Every external system is accessed through an adapter implementing a common interface.

### Adapter Interface

```typescript
export interface SystemAdapter {
  /** Unique adapter identifier */
  readonly code: string;

  /** Execute a request to the external system */
  execute(request: AdapterRequest): Promise<AdapterResponse>;

  /** Check if the external system is reachable */
  healthCheck(): Promise<HealthStatus>;

  /** Adapter metadata for registry */
  getInfo(): AdapterInfo;
}

export interface AdapterInfo {
  code: string;
  name: string;
  type: 'rating_engine' | 'enrichment' | 'callback' | 'event_broker' | 'custom';
  protocol: 'rest' | 'soap' | 'grpc' | 'kafka' | 'mock';
  format: 'json' | 'xml' | 'soap' | 'binary';
  isActive: boolean;
  isMock: boolean;
}
```

### Built-in Adapters

| Adapter | System | Protocol | Format |
|---|---|---|---|
| `ratabase-adapter` | CGI Ratabase | REST | XML |
| `earnix-adapter` | Earnix | REST | JSON |
| `gw-adapter` | Guidewire PolicyCenter | REST | JSON |
| `dnb-adapter` | Dun & Bradstreet | REST | JSON |
| `kafka-adapter` | Kafka (mock) | Kafka | Binary/JSON |

---

## 13. Transaction Lifecycle & Status Machine

### Status Machine

```
    RECEIVED
       │
       ▼
    VALIDATING ──────────► FAILED (validation error)
       │
       ▼
    PROCESSING
       │
       ├──► Step 1: field_mapping    ──► STEP_FAILED ──► FAILED
       ├──► Step 2: apply_rules      ──► STEP_FAILED ──► FAILED
       ├──► Step 3: call_rating_eng  ──► STEP_FAILED ──► FAILED (+ retry?)
       ├──► Step N: ...
       │
       ▼
    COMPLETED
       │
       ├──► premium_result stored
       ├──► response_payload stored
       ├──► all step traces stored
       └──► duration_ms calculated
```

### Per-Step Resilience

Each step can be configured with:

```jsonc
{
  "timeout": 10000,          // max wait time (ms)
  "retry": {
    "maxAttempts": 3,        // total attempts
    "backoffMs": 1000,       // initial wait between retries
    "multiplier": 2          // exponential backoff
  },
  "circuitBreaker": {
    "failureThreshold": 5,   // failures before circuit opens
    "resetAfterMs": 60000    // time before trying again
  },
  "onFailure": "stop"        // "stop" (halt pipeline) | "skip" (continue) | "use_default" (use fallback)
}
```

### Conditional Step Execution

Steps can have conditions — only execute if met:

```jsonc
{
  "stepType": "call_external_api",
  "name": "Call D&B for Large Accounts",
  "config": {
    "systemCode": "dnb-service",
    "condition": {
      "field": "context.working.insured.annualRevenue",
      "operator": "gt",
      "value": 5000000
    }
  }
}
```

---

## 14. Implementation Phases

### Phase 1 — Foundation (Week 1-2)

**Goal:** New folder structure, Nx setup, core-rating + line-rating scaffolding, product-config service extracted.

| # | Task | Service | Priority |
|---|---|---|---|
| 1.1 | Initialize Nx monorepo with `rating-poc/` as root | Infrastructure | P0 |
| 1.2 | Create folder structure: `frontend/`, `orchestrators/`, `services/`, `packages/`, `db/` | Infrastructure | P0 |
| 1.3 | Create `packages/contracts/` with all TypeScript interfaces | Shared | P0 |
| 1.4 | Create `packages/shared/` with logger, correlation, error handling | Shared | P0 |
| 1.5 | Scaffold `orchestrators/core-rating/` NestJS app (port 3001) | Core Rating | P0 |
| 1.6 | Scaffold `orchestrators/line-rating/` NestJS app (port 3003) | Line Rating | P0 |
| 1.7 | Extract `services/product-config/` from existing rating-api (port 3002) | Product Config | P0 |
| 1.8 | Create `db/line-rating/migrations/001_orchestrators_and_steps.sql` | Database | P0 |
| 1.9 | Create `docker-compose.yml` with all services + Postgres + MinIO | Infrastructure | P0 |
| 1.10 | Verify: all services start, health endpoints respond | Infrastructure | P0 |

### Phase 2 — Orchestrator Engine (Week 2-3)

**Goal:** Core-rating engine executes step handlers, line-rating manages flow definitions with auto-generation.

| # | Task | Service | Priority |
|---|---|---|---|
| 2.1 | Build `StepHandlerRegistry` — register/get/list handlers | Core Rating | P0 |
| 2.2 | Build `ExecutionEngine` — load flow, iterate steps, manage context | Core Rating | P0 |
| 2.3 | Build `FieldMappingHandler` — calls transform service | Core Rating | P0 |
| 2.4 | Build `ApplyRulesHandler` — calls rules service | Core Rating | P0 |
| 2.5 | Build `FormatTransformHandler` — calls transform service | Core Rating | P0 |
| 2.6 | Build `CallRatingEngineHandler` — calls external system | Core Rating | P0 |
| 2.7 | Build `CallOrchestratorHandler` — nested orchestration | Core Rating | P1 |
| 2.8 | Build orchestrator CRUD in line-rating | Line Rating | P0 |
| 2.9 | Build auto-generate service (xml-target / json-target templates) | Line Rating | P0 |
| 2.10 | Build `POST /execute/{productLineCode}` endpoint | Core Rating | P0 |
| 2.11 | Integration test: create product → auto-generate flow → execute with mock | Both | P0 |

### Phase 3 — Transform & Rules Services (Week 3-4)

**Goal:** Independent transform and rules services extracted and running.

| # | Task | Service | Priority |
|---|---|---|---|
| 3.1 | Scaffold `services/transform/` NestJS app (port 3004) | Transform | P0 |
| 3.2 | Move `TransformationEngine` + `format.adapter.ts` to transform service | Transform | P0 |
| 3.3 | Build `POST /transform` endpoint | Transform | P0 |
| 3.4 | Build `POST /transform/format` endpoint (JSON↔XML↔SOAP) | Transform | P0 |
| 3.5 | Scaffold `services/rules/` NestJS app (port 3005) | Rules | P0 |
| 3.6 | Move rules evaluation logic to rules service | Rules | P0 |
| 3.7 | Build `POST /evaluate` endpoint with scope filtering | Rules | P0 |
| 3.8 | Create `db/rules/migrations/001_rules_conditions_actions.sql` | Database | P0 |
| 3.9 | Build scope tag CRUD on rules | Rules | P0 |
| 3.10 | Integration test: orchestrator calls transform + rules services | All | P0 |

### Phase 4 — Status Service & Observability (Week 4-5)

**Goal:** Transaction tracking, audit trail, and monitoring dashboard.

| # | Task | Service | Priority |
|---|---|---|---|
| 4.1 | Scaffold `services/status/` NestJS app (port 3006) | Status | P0 |
| 4.2 | Create `db/status/migrations/001_transaction_records.sql` | Database | P0 |
| 4.3 | Build transaction record CRUD | Status | P0 |
| 4.4 | Build step-level recording | Status | P0 |
| 4.5 | Wire orchestrator to call status service (start/step/complete) | Core Rating | P0 |
| 4.6 | Build `GET /dashboard/summary` endpoint | Status | P1 |
| 4.7 | Build `GET /dashboard/product/{code}` endpoint | Status | P1 |
| 4.8 | Add correlation ID propagation across all services | Shared | P0 |

### Phase 5 — Adapters (Week 5-6)

**Goal:** Kafka, D&B, GW adapters (mock implementations).

| # | Task | Service | Priority |
|---|---|---|---|
| 5.1 | Scaffold `services/adapters/kafka/` (port 3010) | Kafka | P1 |
| 5.2 | Build mock Kafka publisher + message inspector | Kafka | P1 |
| 5.3 | Build `PublishEventHandler` in core-rating | Core Rating | P1 |
| 5.4 | Scaffold `services/adapters/dnb/` (port 3011) | D&B | P1 |
| 5.5 | Build mock D&B lookup with sample data | D&B | P1 |
| 5.6 | Build `CallExternalApiHandler` in core-rating | Core Rating | P1 |
| 5.7 | Scaffold `services/adapters/gw/` (port 3012) | GW | P1 |
| 5.8 | Build mock GW callback receiver | GW | P1 |
| 5.9 | Integration test: IMCE flow with D&B enrichment + Kafka publish | All | P1 |

### Phase 6 — Workspace UI (Week 6-8)

**Goal:** Full orchestration framework UI in the workspace.

| # | Task | App | Priority |
|---|---|---|---|
| 6.1 | Create `frontend/workspace/` with Vite + React + Tailwind | Workspace | P0 |
| 6.2 | Build Product Landing page (create/select product) | Workspace | P0 |
| 6.3 | Build Product Home page with dynamic OrchestratorFlow | Workspace | P0 |
| 6.4 | Build OrchestratorFlow — renders steps from API (not hardcoded) | Workspace | P0 |
| 6.5 | Build FieldMappingPanel — inline field editor | Workspace | P0 |
| 6.6 | Build RulesPanel — rules editor with scope tags | Workspace | P0 |
| 6.7 | Build ScopeManager — states/coverages/txn types with lifecycle | Workspace | P0 |
| 6.8 | Build TestPanel — scope selector + payload + step trace | Workspace | P0 |
| 6.9 | Build TransactionMonitor — live + historical transactions | Workspace | P1 |
| 6.10 | Build StepLibrary — browse + add step types | Workspace | P1 |
| 6.11 | Build ConnectionManager — register + test systems | Workspace | P1 |
| 6.12 | Build ActivityFeed | Workspace | P0 |

### Phase 7 — Resilience & Polish (Week 8-9)

**Goal:** Production-grade resilience patterns.

| # | Task | Service | Priority |
|---|---|---|---|
| 7.1 | Add circuit breaker to all inter-service calls | Shared | P1 |
| 7.2 | Add retry policies per step | Core Rating | P1 |
| 7.3 | Add timeout handling per step | Core Rating | P1 |
| 7.4 | Add conditional step execution | Core Rating | P1 |
| 7.5 | Add parallel step group support | Core Rating | P2 |
| 7.6 | Add orchestrator versioning | Line Rating | P2 |
| 7.7 | End-to-end test: full IMCE + GL flows with all adapters | All | P0 |

---

## 15. Port Assignments

| Service | Port | Description |
|---|---|---|
| **Orchestrators** | | |
| core-rating-orchestrator | 3001 | Execution engine, step registry |
| line-rating-orchestrator | 3003 | Flow definitions, auto-generation |
| **Services** | | |
| product-config | 3002 | Product lines, mappings, systems |
| transform | 3004 | Field transformation + format conversion |
| rules | 3005 | Rules engine + evaluation |
| status | 3006 | Transaction status + audit |
| **Adapters** | | |
| kafka-adapter | 3010 | Event publishing (mock) |
| dnb-adapter | 3011 | Company enrichment (mock) |
| gw-adapter | 3012 | GW callbacks (mock) |
| **Frontend** | | |
| workspace UI | 5174 | Orchestration framework UI |
| admin UI | 5173 | Configuration admin UI |
| **Infrastructure** | | |
| PostgreSQL | 5432 | Database |
| MinIO | 9000/9001 | S3-compatible storage |
| Redis | 6379 | Caching (future) |

---

## 16. Team Ownership

| Team | Owns | Services |
|---|---|---|
| **Platform** | Core orchestrator engine, step registry, shared packages | `orchestrators/core-rating/`, `packages/` |
| **Insurance Lines** | Product-specific flow definitions | `orchestrators/line-rating/` |
| **Config** | Product configuration, mappings, systems | `services/product-config/` |
| **Core** | Transformation engine, format adapters | `services/transform/` |
| **Business Logic** | Rules engine, scope-based evaluation | `services/rules/` |
| **Observability** | Transaction tracking, audit, monitoring | `services/status/` |
| **Integration** | External adapters (Kafka, D&B, GW) | `services/adapters/` |
| **UI** | Workspace + Admin front-end apps | `frontend/` |

---

## 17. AWS Deployment Architecture

### Strategy: Hybrid — EKS for Core, Lambda for Adapters

Core services that handle the rating request path need **always-on, low-latency** execution. Adapters and event consumers are infrequent and benefit from **pay-per-use serverless**.

### Architecture Diagram

```
                         ┌──────────────────────────────────────┐
                         │           Amazon CloudFront          │
                         │         (CDN + Static Assets)        │
                         └──────────┬───────────────────────────┘
                                    │
                         ┌──────────▼───────────────────────────┐
                         │        Application Load Balancer      │
                         │    (ALB — routes /api/* to EKS,      │
                         │     /* to S3 static frontend)        │
                         └──────────┬───────────────────────────┘
                                    │
          ┌─────────────────────────▼─────────────────────────────────┐
          │                     Amazon EKS Cluster                     │
          │                                                            │
          │  ┌─────────────────┐  ┌─────────────────┐                 │
          │  │  core-rating    │  │  line-rating     │                 │
          │  │  orchestrator   │  │  orchestrator    │                 │
          │  │  (2-4 pods)     │  │  (2 pods)        │                 │
          │  └────────┬────────┘  └────────┬─────────┘                │
          │           │                    │                           │
          │  ┌────────▼────────┐  ┌────────▼─────────┐               │
          │  │  product-config │  │  transform       │                │
          │  │  service        │  │  service          │               │
          │  │  (2-4 pods)     │  │  (2-4 pods)       │               │
          │  └─────────────────┘  └──────────────────┘                │
          │                                                            │
          │  ┌─────────────────┐  ┌──────────────────┐               │
          │  │  rules          │  │  status           │               │
          │  │  service        │  │  service           │              │
          │  │  (2-4 pods)     │  │  (2-4 pods)        │              │
          │  └─────────────────┘  └──────────────────┘                │
          │                                                            │
          │  ┌────────────────────────────────────────┐               │
          │  │  Ingress Controller (NGINX/ALB Ingress) │               │
          │  │  /orchestrator/*  → core-rating         │               │
          │  │  /line-rating/*   → line-rating         │               │
          │  │  /config/*        → product-config      │               │
          │  │  /transform/*     → transform           │               │
          │  │  /rules/*         → rules               │               │
          │  │  /status/*        → status              │               │
          │  └────────────────────────────────────────┘               │
          └───────────────────────────────────────────────────────────┘
                        │                    │
          ┌─────────────▼──────┐  ┌──────────▼──────────────┐
          │   Amazon Lambda    │  │   AWS Managed Services   │
          │                    │  │                          │
          │  ┌──────────────┐  │  │  ┌──────────────────┐   │
          │  │ D&B Adapter  │  │  │  │  Amazon RDS      │   │
          │  │ (Lambda fn)  │  │  │  │  (PostgreSQL)    │   │
          │  └──────────────┘  │  │  │  Multi-AZ        │   │
          │                    │  │  └──────────────────┘   │
          │  ┌──────────────┐  │  │                          │
          │  │ GW Adapter   │  │  │  ┌──────────────────┐   │
          │  │ (Lambda fn)  │  │  │  │  Amazon MSK      │   │
          │  └──────────────┘  │  │  │  (Kafka)         │   │
          │                    │  │  └──────────────────┘   │
          │  ┌──────────────┐  │  │                          │
          │  │ Kafka Event  │  │  │  ┌──────────────────┐   │
          │  │ Consumer     │  │  │  │  Amazon S3       │   │
          │  │ (Lambda+MSK) │  │  │  │  (Knowledge Base)│   │
          │  └──────────────┘  │  │  └──────────────────┘   │
          │                    │  │                          │
          │  ┌──────────────┐  │  │  ┌──────────────────┐   │
          │  │ Status Event │  │  │  │  ElastiCache     │   │
          │  │ Consumer     │  │  │  │  (Redis)         │   │
          │  │ (Lambda+SQS) │  │  │  └──────────────────┘   │
          │  └──────────────┘  │  │                          │
          └────────────────────┘  │  ┌──────────────────┐   │
                                  │  │  CloudWatch      │   │
                                  │  │  (Logs + Metrics)│   │
                                  │  └──────────────────┘   │
                                  │                          │
                                  │  ┌──────────────────┐   │
                                  │  │  X-Ray           │   │
                                  │  │  (Dist. Tracing) │   │
                                  │  └──────────────────┘   │
                                  └──────────────────────────┘
```

### Why EKS for Core Services

| Factor | Rationale |
|---|---|
| **Zero cold starts** | Orchestrator flow touches 4-6 services per request. Lambda cold starts (1-3s per hop) would compound to 10-15s. EKS pods are always warm. |
| **NestJS compatibility** | NestJS bundles are 50-80MB. Lambda's 250MB limit is tight for decorated DI frameworks. EKS runs any container. |
| **Connection pooling** | Each EKS pod maintains a persistent Postgres connection pool. Lambda would need RDS Proxy ($$$) per service. |
| **Kafka consumers** | Status service and event consumers need always-running listeners. EKS pods are natural for this. |
| **Service mesh** | AWS App Mesh or Istio on EKS gives mTLS, traffic shaping, canary deployments between services. |
| **HPA (autoscaling)** | Horizontal Pod Autoscaler scales pods 2→20 based on CPU/request rate. Predictable scaling for rate spikes. |
| **Industry standard** | Enterprise insurance (GW, Earnix, CGI) ecosystems run on Kubernetes. Ops teams expect it. |

### Why Lambda for Adapters

| Factor | Rationale |
|---|---|
| **Infrequent calls** | D&B lookup happens 0-1 times per rating request. GW callback happens once. Not worth a running pod. |
| **Simple logic** | Adapters are thin wrappers: receive request → call external API → return response. Fits Lambda perfectly. |
| **Pay per use** | D&B adapter may be called 100 times/day. Lambda cost: ~$0.01/day. EKS pod: ~$2/day. |
| **Independent scaling** | If D&B API is slow, Lambda handles queuing naturally. No impact on EKS cluster sizing. |
| **Event triggers** | Kafka consumer Lambda is triggered by MSK natively. Status event consumer triggered by SQS. No polling code needed. |

### EKS Cluster Configuration

```yaml
# Per-service pod specification
services:
  core-rating-orchestrator:
    replicas: 2-4             # HPA: scale on CPU > 60%
    cpu: 512m-1000m
    memory: 512Mi-1Gi
    readinessProbe: /health
    livenessProbe: /health
    env:
      - LINE_RATING_URL: http://line-rating-svc:3003
      - PRODUCT_CONFIG_URL: http://product-config-svc:3002
      - TRANSFORM_URL: http://transform-svc:3004
      - RULES_URL: http://rules-svc:3005
      - STATUS_URL: http://status-svc:3006

  line-rating-orchestrator:
    replicas: 2
    cpu: 256m-512m
    memory: 256Mi-512Mi

  product-config:
    replicas: 2-4             # scales with config read load
    cpu: 512m-1000m
    memory: 512Mi-1Gi

  transform:
    replicas: 2-4             # scales with mapping volume
    cpu: 512m-1000m
    memory: 512Mi-1Gi

  rules:
    replicas: 2-4             # scales with rule evaluation load
    cpu: 256m-512m
    memory: 256Mi-512Mi

  status:
    replicas: 2-4             # high write volume
    cpu: 256m-512m
    memory: 256Mi-512Mi
```

### Database Strategy (RDS)

```
Production:
  ┌─────────────────────────────────────────────────────────┐
  │  Amazon RDS PostgreSQL (Multi-AZ)                       │
  │                                                          │
  │  Schema: orchestrator_db   ← line-rating service        │
  │  Schema: product_config_db ← product-config service     │
  │  Schema: rules_db          ← rules service              │
  │  Schema: status_db         ← status service             │
  │                                                          │
  │  Instance: db.r6g.xlarge (4 vCPU, 32GB RAM)            │
  │  Storage: gp3, 500GB, 3000 IOPS                         │
  │  Read Replicas: 1 (for status dashboard queries)        │
  └─────────────────────────────────────────────────────────┘

POC (Local Docker):
  Single Postgres container, separate schemas per service.
  Same migrations, same code — just different connection strings.
```

### Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│  VPC: 10.0.0.0/16                                       │
│                                                          │
│  ┌──────────────────────────┐                           │
│  │ Public Subnets (2 AZs)  │                           │
│  │  ALB, NAT Gateway       │                           │
│  └──────────┬───────────────┘                           │
│             │                                            │
│  ┌──────────▼───────────────┐                           │
│  │ Private Subnets (2 AZs) │                           │
│  │  EKS Nodes, Lambda      │                           │
│  │  (no direct internet)   │                           │
│  └──────────┬───────────────┘                           │
│             │                                            │
│  ┌──────────▼───────────────┐                           │
│  │ Data Subnets (2 AZs)    │                           │
│  │  RDS, ElastiCache, MSK  │                           │
│  │  (no internet at all)   │                           │
│  └──────────────────────────┘                           │
│                                                          │
│  Security Groups:                                        │
│  - EKS pods → RDS (5432)                                │
│  - EKS pods → MSK (9092)                                │
│  - EKS pods → ElastiCache (6379)                        │
│  - Lambda → RDS (5432) via VPC endpoint                 │
│  - Lambda → MSK (9092) via VPC endpoint                 │
│  - ALB → EKS pods (3001-3006)                           │
│  - External adapters → NAT Gateway → internet           │
└─────────────────────────────────────────────────────────┘
```

### CI/CD Pipeline

```
Developer pushes to Git
       │
       ▼
┌──────────────────┐
│  GitHub Actions   │  (or CodePipeline)
│                   │
│  1. Nx affected   │  ← only build/test changed services
│  2. Unit tests    │
│  3. Lint          │
│  4. Docker build  │  ← per service: services/transform/ → transform:v1.2.3
│  5. Push to ECR   │  ← Amazon ECR (container registry)
│  6. Helm upgrade  │  ← deploy to EKS via Helm charts
│  7. Lambda deploy │  ← SAM/CDK deploy for adapter functions
│  8. Smoke tests   │  ← hit /health on each service
└──────────────────┘

Environments:
  dev    → auto-deploy on merge to develop
  staging → auto-deploy on merge to main
  prod   → manual approval gate → deploy
```

### Helm Charts (Per Service)

```
infra/
├── helm/
│   ├── core-rating/
│   │   ├── Chart.yaml
│   │   ├── values.yaml            ← default config
│   │   ├── values-dev.yaml        ← dev overrides
│   │   ├── values-staging.yaml
│   │   ├── values-prod.yaml
│   │   └── templates/
│   │       ├── deployment.yaml
│   │       ├── service.yaml
│   │       ├── hpa.yaml
│   │       └── ingress.yaml
│   ├── line-rating/
│   ├── product-config/
│   ├── transform/
│   ├── rules/
│   └── status/
├── terraform/                     ← infrastructure as code
│   ├── vpc.tf
│   ├── eks.tf
│   ├── rds.tf
│   ├── msk.tf
│   ├── elasticache.tf
│   ├── s3.tf
│   ├── lambda.tf
│   ├── ecr.tf
│   └── variables.tf
└── cdk/                           ← alternative: AWS CDK (TypeScript)
    └── ...
```

### Observability Stack

| Tool | Purpose | Integration |
|---|---|---|
| **CloudWatch Logs** | Centralized structured JSON logs from all services | Fluent Bit sidecar on each EKS pod |
| **CloudWatch Metrics** | Custom metrics: transactions/sec, step duration, error rate | Embedded metrics format from NestJS |
| **AWS X-Ray** | Distributed tracing across all service calls | X-Ray SDK in `packages/shared`, correlation ID mapped to X-Ray trace ID |
| **CloudWatch Alarms** | Alerting on error rate > 5%, p99 latency > 5s, circuit breaker open | Per-service alarms + SNS notification |
| **CloudWatch Dashboards** | Per-product-line dashboard: transaction volume, success rate, avg premium, top errors | Built from status service metrics |
| **AWS Grafana** (optional) | Advanced visualization, historical trends, capacity planning | Pulls from CloudWatch + RDS metrics |

### Cost Estimate (Production — Moderate Load)

```
Workload assumption: 10,000 rating requests/day, 6 core services

EKS Cluster:
  Control plane:           $73/month
  Worker nodes (3x m5.xlarge, on-demand):  $420/month
  Worker nodes (spot, ~60% savings):       ~$170/month

RDS PostgreSQL:
  db.r6g.xlarge, Multi-AZ: $580/month
  Read replica:             $290/month
  Storage (500GB gp3):      $40/month

Lambda (adapters):
  ~30,000 invocations/day × 500ms avg: ~$5/month

MSK (Kafka):
  kafka.m5.large, 2 brokers: $340/month

ElastiCache (Redis):
  cache.r6g.large:          $200/month

S3, CloudWatch, ECR:        ~$50/month

Total (on-demand):    ~$2,000/month
Total (with savings): ~$1,300/month (spot nodes + reserved RDS)
```

### Local Development vs Production Parity

| Aspect | Local (Docker Compose) | Production (AWS) |
|---|---|---|
| Orchestrator | `docker compose up core-rating` | EKS pod |
| Database | Single Postgres container, separate schemas | RDS Multi-AZ, separate schemas |
| Kafka | Mock service on port 3010 | Amazon MSK |
| S3 | MinIO on port 9000 | Amazon S3 |
| Redis | Redis container on port 6379 | ElastiCache |
| Adapters | Mock services in Docker | Lambda functions |
| Networking | `docker network` | VPC with private subnets |
| CI/CD | `nx run-many --target=test` | GitHub Actions + Helm |

Same code, same container images, same environment variables — only the infrastructure provider changes.

---

## Appendix: Existing Files (Legacy POC)

The existing `apps/` directory contains the current POC implementation:
- `apps/admin-ui/` → migrates to `frontend/admin/`
- `apps/rating-api/` → splits into `services/product-config/` + `services/transform/`
- `apps/rating-workspace/` → migrates to `frontend/workspace/`
- `apps/orchestrator/` → replaced by `orchestrators/core-rating/` + `orchestrators/line-rating/`
- `packages/shared/` → migrates to `packages/contracts/` + `packages/shared/`
- `database/` → splits into `db/` per service

These remain functional during development. Migration happens progressively — new services are built in the new structure, old apps are retired once replaced.
