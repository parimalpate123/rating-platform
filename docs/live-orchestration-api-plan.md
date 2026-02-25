# Live Orchestration + Rating Platform Public API — Implementation Plan

## Context

The orchestration engine in `core-rating` (port 4000) executes steps that mutate `context.working`, but the API response only returns `context.response` (set by `CallRatingEngineHandler`). Without a rating engine step, all mapping/rules transformations are invisible to the caller.

**Example:** The IMCE product has a 9-step flow (Validate → Map Request → Pre-Rating Rules → JSON to XML → Call CGI → XML to JSON → Map Response → Post-Rating Rules → Publish Event). If a caller only configures mapping and rules steps (no rating engine), the response `data` is empty — all the work done by Map Request Fields, Pre-Rating Rules, etc. is lost.

This plan adds:
1. `working` data in every API response so consumers see the effect of every step
2. A product-first public API at `POST /api/v1/{productCode}/rate` for external systems
3. Future backlog: authentication, rate limiting, schema validation, OpenAPI docs

---

## Current Architecture Reference

### Core-Rating Service Layout

```
orchestrators/core-rating/src/
├── main.ts                          # Bootstrap: port 4000, prefix api/v1, CORS
├── app/
│   ├── app.module.ts                # Root module: Registry, Execution, Handlers, Rating, MockSystems
│   ├── app.controller.ts            # GET /health
│   └── app.service.ts
├── registry/
│   ├── registry.module.ts           # Global singleton StepHandlerRegistry
│   ├── registry.controller.ts       # GET /registry/handlers, GET /registry/handlers/health
│   └── step-handler.registry.ts     # Map<string, StepHandler> — register/get/list/healthCheck
├── execution/
│   ├── execution.module.ts          # Provides ExecutionService
│   ├── execution.controller.ts      # POST /execute (direct pipeline execution)
│   └── execution.service.ts         # Main loop: conditions → circuit breaker → handler → retry
├── handlers/
│   ├── handlers.module.ts           # Registers all 10 handlers on init
│   ├── field-mapping.handler.ts     # type: field_mapping
│   ├── apply-rules.handler.ts       # type: apply_rules
│   ├── format-transform.handler.ts  # type: format_transform
│   ├── call-rating-engine.handler.ts# type: call_rating_engine
│   ├── call-external-api.handler.ts # type: call_external_api
│   ├── publish-event.handler.ts     # type: publish_event
│   ├── validate-request.handler.ts  # type: validate_request
│   ├── enrich.handler.ts            # type: enrich
│   ├── generate-value.handler.ts    # type: generate_value
│   └── run-custom-flow.handler.ts   # type: run_custom_flow
├── rating/
│   ├── rating.module.ts             # Provides RatingService + RatingController
│   ├── rating.controller.ts         # POST /rate/:productLineCode, POST /rate/:productLineCode/:endpointPath
│   └── rating.service.ts            # End-to-end: fetch flow → create tx → execute → update tx
└── mock/
    ├── mock-systems.module.ts
    └── mock-systems.controller.ts   # Mock Earnix, CGI, Duck Creek, GW PolicyCenter
```

### Current Execution Context Shape

```typescript
// Built in execution.service.ts line 203–217
const context = {
  correlationId: string,
  transactionId: string,
  productLineCode: string,
  scope: { state?: string, coverage?: string, transactionType?: string },
  request: Record<string, unknown>,    // Original payload (immutable)
  working: Record<string, unknown>,    // Mutable — each step transforms this
  enrichments: {},                     // Populated by enrich handler
  response: {},                        // Set by call_rating_engine handler
  metadata: { stepResults, startedAt, currentStep },
};
```

### Current ExecutionResult Interface

```typescript
// execution.service.ts line 67–73
export interface ExecutionResult {
  correlationId: string;
  status: 'completed' | 'failed';
  stepResults: StepResultEntry[];
  response: Record<string, unknown>;   // Only from context.response
  totalDurationMs: number;
  // ❌ MISSING: working — the transformed state from all steps
}
```

### Current RateResponse Interface

```typescript
// rating.service.ts line 21–37
export interface RateResponse {
  transactionId: string;
  correlationId: string;
  productLineCode: string;
  status: 'completed' | 'failed';
  response: Record<string, unknown>;   // From execution result
  // ❌ MISSING: data — the final working state
  stepResults: Array<{ stepId, stepType, stepName, status, durationMs, error?, output? }>;
  totalDurationMs: number;
}
```

### Current API Routes

| Method | Path | Controller | Handler |
|---|---|---|---|
| GET | `/api/v1/health` | AppController | Health check |
| POST | `/api/v1/execute` | ExecutionController | Direct pipeline execution |
| POST | `/api/v1/rate/:productLineCode` | RatingController | Rate with default flow |
| POST | `/api/v1/rate/:productLineCode/:endpointPath` | RatingController | Rate with named flow |
| GET | `/api/v1/registry/handlers` | RegistryController | List handlers |
| POST | `/api/v1/mock/earnix/rate` | MockSystemsController | Mock Earnix |
| POST | `/api/v1/mock/ratabase/rate` | MockSystemsController | Mock CGI |
| POST | `/api/v1/mock/duck-creek/rate` | MockSystemsController | Mock Duck Creek |
| POST | `/api/v1/mock/gw-policycenter/init-rate` | MockSystemsController | Mock GW |

### ALB Routing (Production)

```
Priority 10 → /api/v1/orchestrators/*, /api/v1/custom-flows/*  → line-rating:4001
Priority 20 → /api/v1/transactions/*                           → status-service:4013
Priority 30 → /api/v1/transform/*                              → transform-service:4011
Priority 40 → /api/v1/rules/*, /api/v1/ai-prompts/*            → rules-service:4012
Priority 50 → /api/v1/product-lines/*, /api/v1/mappings/*, etc → product-config:4010
Priority 90 → /api/v1/*                                        → core-rating:4000 (catch-all)
```

The priority-90 catch-all means any new routes under `/api/v1/` on core-rating are automatically routed correctly.

### Vite Dev Proxy

```
/api/core-rating → http://localhost:4000/api/v1
```

No changes needed — new routes at `/api/v1/{productCode}/rate` are covered by the existing catch-all.

---

## Phase 1: Expose `working` in ExecutionResult

**Goal:** Make `context.working` available in the execution engine's return value so downstream consumers can see the transformed state.

**File:** `orchestrators/core-rating/src/execution/execution.service.ts`

### Change 1: Update ExecutionResult interface

**Location:** Lines 67–73

```typescript
// BEFORE
export interface ExecutionResult {
  correlationId: string;
  status: 'completed' | 'failed';
  stepResults: StepResultEntry[];
  response: Record<string, unknown>;
  totalDurationMs: number;
}

// AFTER
export interface ExecutionResult {
  correlationId: string;
  status: 'completed' | 'failed';
  stepResults: StepResultEntry[];
  response: Record<string, unknown>;
  working: Record<string, unknown>;    // ← NEW: final state of context.working
  totalDurationMs: number;
}
```

### Change 2: Add `working` to all 4 return paths

There are exactly 4 `return` statements in the `execute()` method that return an `ExecutionResult`. Each must include `working: context.working`.

**Return path 1 — Circuit breaker open + onFailure=stop (line 276):**
```typescript
return {
  correlationId: request.correlationId,
  status: 'failed',
  stepResults,
  response: context.response,
  working: context.working,    // ← ADD
  totalDurationMs: Date.now() - startTime,
};
```

**Return path 2 — No handler registered for step type (line 302):**
```typescript
return {
  correlationId: request.correlationId,
  status: 'failed',
  stepResults,
  response: context.response,
  working: context.working,    // ← ADD
  totalDurationMs: Date.now() - startTime,
};
```

**Return path 3 — Step failed + onFailure=stop (line 348) AND catch block + onFailure=stop (line 374):**

Both of these return the same shape. Add `working: context.working` to each.

**Return path 4 — Success (line 385):**
```typescript
return {
  correlationId: request.correlationId,
  status: 'completed',
  stepResults,
  response: context.response,
  working: context.working,    // ← ADD
  totalDurationMs: Date.now() - startTime,
};
```

### Why all 4 paths matter

Even on failure, the `working` state contains partial transformations up to the point of failure. This is critical for debugging — if step 3 (Pre-Rating Rules) fails, the caller can see that step 2 (Map Request Fields) successfully transformed the data.

### Verification

```bash
npx nx typecheck core-rating   # Ensure no type errors
```

No runtime changes yet — `ExecutionController.execute()` returns the full `ExecutionResult` already, so the `/execute` endpoint will automatically include `working`. The `/rate` endpoint won't surface it until Phase 2.

---

## Phase 2: Surface `data` in RateResponse

**Goal:** Include the final `context.working` as `data` in the rating API response, and store it in the transaction audit trail.

**File:** `orchestrators/core-rating/src/rating/rating.service.ts`

### Change 1: Update RateResponse interface

**Location:** Lines 21–37

```typescript
// BEFORE
export interface RateResponse {
  transactionId: string;
  correlationId: string;
  productLineCode: string;
  status: 'completed' | 'failed';
  response: Record<string, unknown>;
  stepResults: Array<{
    stepId: string;
    stepType: string;
    stepName: string;
    status: string;
    durationMs: number;
    error?: string;
    output?: Record<string, unknown>;
  }>;
  totalDurationMs: number;
}

// AFTER
export interface RateResponse {
  transactionId: string;
  correlationId: string;
  productLineCode: string;
  status: 'completed' | 'failed';
  data: Record<string, unknown>;       // ← NEW: final working state after all steps
  response: Record<string, unknown>;
  stepResults: Array<{
    stepId: string;
    stepType: string;
    stepName: string;
    status: string;
    durationMs: number;
    error?: string;
    output?: Record<string, unknown>;
  }>;
  totalDurationMs: number;
}
```

### Change 2: Populate `data` in return object

**Location:** Lines 154–162

```typescript
// BEFORE
return {
  transactionId,
  correlationId,
  productLineCode: request.productLineCode,
  status: executionResult.status,
  response: executionResult.response,
  stepResults: executionResult.stepResults,
  totalDurationMs,
};

// AFTER
return {
  transactionId,
  correlationId,
  productLineCode: request.productLineCode,
  status: executionResult.status,
  data: executionResult.working,         // ← NEW
  response: executionResult.response,
  stepResults: executionResult.stepResults,
  totalDurationMs,
};
```

### Change 3: Include `workingData` in status-service transaction update

**Location:** Lines 114–125 (the `axios.put` to update the transaction)

```typescript
// BEFORE
await axios.put(
  `${this.statusUrl}/api/v1/transactions/${transactionId}`,
  {
    status: executionResult.status === 'completed' ? 'COMPLETED' : 'FAILED',
    responsePayload: executionResult.response,
    durationMs: totalDurationMs,
    completedSteps: executionResult.stepResults.filter((r) => r.status === 'completed').length,
    premiumResult: (executionResult.response as any)?.premium ?? null,
    errorMessage: executionResult.stepResults.find((r) => r.error)?.error ?? null,
  },
  { headers: { 'x-correlation-id': correlationId } },
);

// AFTER
await axios.put(
  `${this.statusUrl}/api/v1/transactions/${transactionId}`,
  {
    status: executionResult.status === 'completed' ? 'COMPLETED' : 'FAILED',
    responsePayload: executionResult.response,
    workingData: executionResult.working,   // ← NEW: audit trail captures transformed state
    durationMs: totalDurationMs,
    completedSteps: executionResult.stepResults.filter((r) => r.status === 'completed').length,
    premiumResult: (executionResult.response as any)?.premium ?? null,
    errorMessage: executionResult.stepResults.find((r) => r.error)?.error ?? null,
  },
  { headers: { 'x-correlation-id': correlationId } },
);
```

**Note:** The status-service may or may not already have a `workingData` column. If not, it will silently ignore the extra field (TypeORM partial updates). A future migration can add the column when needed — this is forward-compatible.

### Behavior Examples

**Scenario 1: Full 9-step IMCE flow (with rating engine)**
```
data = final context.working after all 9 steps (map request → rules → XML → engine → XML→JSON → map response → rules)
response = CGI Ratabase engine output (set by CallRatingEngineHandler)
```

**Scenario 2: Mapping + rules only (no rating engine)**
```
data = transformed working state after field mapping + rule application
response = {} (empty — no engine called)
```

**Scenario 3: No steps configured → NotFoundException (existing behavior unchanged)**

**Scenario 4: Step fails at step 3 → status='failed'**
```
data = working state as of step 3 failure (includes step 1+2 transforms)
response = {} (engine never called)
```

### Verification

```bash
npx nx typecheck core-rating
npx nx build core-rating
```

Manual test:
```bash
# Hit existing endpoint — should now include `data` field
curl -X POST http://localhost:4000/api/v1/rate/IMCE \
  -H "Content-Type: application/json" \
  -d '{"payload":{"quoteNumber":"Q-123","insured":{"state":"NY"}},"scope":{"state":"NY"}}'
```

Expected: Response includes `data` with the transformed working state alongside `response` and `stepResults`.

---

## Phase 3: Create PlatformApiModule + Controller

**Goal:** Add the product-first public API at `POST /api/v1/{productCode}/rate` for external system integration.

### Why a new endpoint?

The existing endpoint `POST /api/v1/rate/GL` puts the verb first (`rate`), which is an internal convention. External systems prefer a resource-first URL: `POST /api/v1/GL/rate` — the product code is the resource, `rate` is the action. This also allows future actions like `POST /api/v1/GL/validate`, `POST /api/v1/GL/quote`, etc.

### 3a. Create PlatformApiController

**File (new):** `orchestrators/core-rating/src/platform-api/platform-api.controller.ts`

```typescript
import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { RatingService, RateRequest } from '../rating/rating.service';

@Controller(':productCode')
export class PlatformApiController {
  constructor(private readonly ratingService: RatingService) {}

  /**
   * POST /api/v1/GL/rate
   * Product-first public API — uses default flow (endpointPath = 'rate')
   */
  @Post('rate')
  @HttpCode(200)
  async rate(
    @Param('productCode') productCode: string,
    @Body() body: Omit<RateRequest, 'productLineCode'>,
  ) {
    return this.ratingService.rate({ productLineCode: productCode, ...body });
  }

  /**
   * POST /api/v1/GL/rate/quote
   * Product-first public API with named flow
   * Allows product-specific flows like /init-rate, /quote, /renew
   */
  @Post('rate/:flowName')
  @HttpCode(200)
  async rateWithFlow(
    @Param('productCode') productCode: string,
    @Param('flowName') flowName: string,
    @Body() body: Omit<RateRequest, 'productLineCode' | 'endpointPath'>,
  ) {
    return this.ratingService.rate({
      productLineCode: productCode,
      endpointPath: flowName,
      ...body,
    });
  }
}
```

**Key decisions:**
- Controller path is `:productCode` (parameterized) — NestJS will only match this AFTER all static routes (`health`, `rate`, `execute`, `registry`, `mock`) are checked
- Reuses the same `RatingService.rate()` method — no code duplication
- Both endpoints accept the same `{ payload, scope }` body as existing endpoints
- `@HttpCode(200)` — POST returns 200 (not 201) since we're not creating a resource

### 3b. Create PlatformApiModule

**File (new):** `orchestrators/core-rating/src/platform-api/platform-api.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PlatformApiController } from './platform-api.controller';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [RatingModule],          // ← Imports RatingModule to get RatingService
  controllers: [PlatformApiController],
})
export class PlatformApiModule {}
```

### 3c. Export RatingService from RatingModule

**File:** `orchestrators/core-rating/src/rating/rating.module.ts`

```typescript
// BEFORE
@Module({
  imports: [ExecutionModule],
  providers: [RatingService],
  controllers: [RatingController],
})
export class RatingModule {}

// AFTER
@Module({
  imports: [ExecutionModule],
  providers: [RatingService],
  controllers: [RatingController],
  exports: [RatingService],          // ← ADD: allows PlatformApiModule to inject it
})
export class RatingModule {}
```

### 3d. Wire PlatformApiModule into AppModule

**File:** `orchestrators/core-rating/src/app/app.module.ts`

```typescript
// BEFORE
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegistryModule } from '../registry/registry.module';
import { ExecutionModule } from '../execution/execution.module';
import { HandlersModule } from '../handlers/handlers.module';
import { RatingModule } from '../rating/rating.module';
import { MockSystemsModule } from '../mock/mock-systems.module';

@Module({
  imports: [RegistryModule, ExecutionModule, HandlersModule, RatingModule, MockSystemsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

// AFTER
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RegistryModule } from '../registry/registry.module';
import { ExecutionModule } from '../execution/execution.module';
import { HandlersModule } from '../handlers/handlers.module';
import { RatingModule } from '../rating/rating.module';
import { MockSystemsModule } from '../mock/mock-systems.module';
import { PlatformApiModule } from '../platform-api/platform-api.module';  // ← ADD

@Module({
  imports: [
    RegistryModule,
    ExecutionModule,
    HandlersModule,
    RatingModule,
    MockSystemsModule,
    PlatformApiModule,   // ← ADD
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

### Route Conflict Analysis

NestJS resolves routes by matching static segments before parameterized ones. Here's the complete route table after this change:

| Request | Matched Controller | Why |
|---|---|---|
| `GET /api/v1/health` | AppController | Static `health` wins over `:productCode` |
| `POST /api/v1/rate/GL` | RatingController | Static `rate` wins over `:productCode` |
| `POST /api/v1/rate/GL/quote` | RatingController | Static `rate` wins over `:productCode` |
| `POST /api/v1/execute` | ExecutionController | Static `execute` wins over `:productCode` |
| `GET /api/v1/registry/handlers` | RegistryController | Static `registry` wins over `:productCode` |
| `POST /api/v1/mock/earnix/rate` | MockSystemsController | Static `mock` wins over `:productCode` |
| `POST /api/v1/GL/rate` | **PlatformApiController** | `:productCode` = GL |
| `POST /api/v1/IMCE/rate` | **PlatformApiController** | `:productCode` = IMCE |
| `POST /api/v1/IMCE/rate/quote` | **PlatformApiController** | `:productCode` = IMCE, `:flowName` = quote |
| `POST /api/v1/IMCE/rate/init-rate` | **PlatformApiController** | `:productCode` = IMCE, `:flowName` = init-rate |

**No conflicts.** All existing endpoints continue to work unchanged.

**Edge case:** If someone creates a product with code `health`, `rate`, `execute`, `registry`, or `mock`, those routes would shadow the product API. This is acceptable — these are reserved words and should be documented as such.

### Verification

```bash
npx nx typecheck core-rating
npx nx build core-rating
```

Manual tests:
```bash
# New product-first endpoint
curl -X POST http://localhost:4000/api/v1/IMCE/rate \
  -H "Content-Type: application/json" \
  -d '{"payload":{"quoteNumber":"Q-123"},"scope":{"state":"NY"}}'

# New endpoint with named flow
curl -X POST http://localhost:4000/api/v1/IMCE/rate/init-rate \
  -H "Content-Type: application/json" \
  -d '{"payload":{"quoteNumber":"Q-123"},"scope":{"state":"NY"}}'

# Existing endpoint still works
curl -X POST http://localhost:4000/api/v1/rate/IMCE \
  -H "Content-Type: application/json" \
  -d '{"payload":{"quoteNumber":"Q-123"},"scope":{"state":"NY"}}'

# Health check still works
curl http://localhost:4000/api/v1/health
```

---

## Complete Files Summary (Phases 1–3)

| Phase | File | Action | Lines Changed |
|---|---|---|---|
| 1 | `orchestrators/core-rating/src/execution/execution.service.ts` | Edit | ~10 lines (interface + 4 return paths) |
| 2 | `orchestrators/core-rating/src/rating/rating.service.ts` | Edit | ~5 lines (interface + return + tx update) |
| 3a | `orchestrators/core-rating/src/platform-api/platform-api.controller.ts` | **Create** | ~35 lines |
| 3b | `orchestrators/core-rating/src/platform-api/platform-api.module.ts` | **Create** | ~10 lines |
| 3c | `orchestrators/core-rating/src/rating/rating.module.ts` | Edit | 1 line (add exports) |
| 3d | `orchestrators/core-rating/src/app/app.module.ts` | Edit | 2 lines (import + add to array) |

**Total:** 2 new files, 4 edited files, ~63 lines of code.

---

## Infrastructure Impact

| Component | Change Needed | Reason |
|---|---|---|
| ALB routing (Terraform) | **None** | Priority-90 catch-all `/api/v1/*` → core-rating covers all new paths |
| Vite dev proxy | **None** | `/api/core-rating` → `http://localhost:4000/api/v1` covers all paths |
| ECS task definition | **None** | Same container, same port (4000) |
| Database | **None** | No new tables or columns required (workingData is forward-compatible) |
| Kubernetes ingress | **None** | Same service routing |

---

## Request/Response Contract

### Existing Endpoint (unchanged)

```
POST /api/v1/rate/{productLineCode}
POST /api/v1/rate/{productLineCode}/{endpointPath}
```

### New Public Endpoint

```
POST /api/v1/{productCode}/rate
POST /api/v1/{productCode}/rate/{flowName}
```

### Request Body (same for both)

```json
{
  "payload": {
    "quoteNumber": "Q-12345",
    "insured": {
      "name": "Acme Construction LLC",
      "state": "NY",
      "annualRevenue": 5000000
    },
    "coverage": {
      "type": "BOP",
      "limit": 1000000,
      "deductible": 5000
    },
    "policy": {
      "effectiveDate": "2026-04-01",
      "expirationDate": "2027-04-01"
    }
  },
  "scope": {
    "state": "NY",
    "coverage": "BOP",
    "transactionType": "new_business"
  }
}
```

### Response (after Phase 2)

```json
{
  "transactionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "correlationId": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
  "productLineCode": "IMCE",
  "status": "completed",
  "data": {
    "policy": {
      "quoteId": "Q-12345",
      "effectiveDate": "04/01/2026",
      "state": "NY"
    },
    "rating": {
      "basePremium": 57500,
      "territoryFactor": 1.15,
      "buildingAgeSurcharge": 0.15
    },
    "quote": {
      "totalPremium": 72000,
      "referenceNumber": "Q-12345"
    },
    "_flags": ["high_value"]
  },
  "response": {
    "premium": {
      "final": 72000,
      "breakdown": {
        "base": 50000,
        "territory": 7500,
        "surcharges": 14500
      }
    },
    "engineId": "CGI-RATE-2026-0001"
  },
  "stepResults": [
    {
      "stepId": "uuid-1",
      "stepType": "validate_request",
      "stepName": "Validate request",
      "status": "completed",
      "durationMs": 2
    },
    {
      "stepId": "uuid-2",
      "stepType": "field_mapping",
      "stepName": "Map Request Fields",
      "status": "completed",
      "durationMs": 45,
      "output": {
        "serviceResponse": { "fieldsApplied": 8, "totalFields": 12 }
      }
    },
    {
      "stepId": "uuid-3",
      "stepType": "apply_rules",
      "stepName": "Pre-Rating Rules",
      "status": "completed",
      "durationMs": 32,
      "output": {
        "serviceResponse": { "rulesEvaluated": 5, "rulesApplied": 2 }
      }
    },
    {
      "stepId": "uuid-4",
      "stepType": "format_transform",
      "stepName": "JSON to XML",
      "status": "completed",
      "durationMs": 8
    },
    {
      "stepId": "uuid-5",
      "stepType": "call_rating_engine",
      "stepName": "Call CGI Ratabase",
      "status": "completed",
      "durationMs": 180,
      "output": {
        "ratingEngine": "cgi-ratabase",
        "isMock": false,
        "premium": 72000
      }
    },
    {
      "stepId": "uuid-6",
      "stepType": "format_transform",
      "stepName": "XML to JSON",
      "status": "completed",
      "durationMs": 5
    },
    {
      "stepId": "uuid-7",
      "stepType": "field_mapping",
      "stepName": "Map Response Fields",
      "status": "completed",
      "durationMs": 28,
      "output": {
        "serviceResponse": { "fieldsApplied": 4, "totalFields": 4 }
      }
    },
    {
      "stepId": "uuid-8",
      "stepType": "apply_rules",
      "stepName": "Post-Rating Rules",
      "status": "completed",
      "durationMs": 15,
      "output": {
        "serviceResponse": { "rulesEvaluated": 3, "rulesApplied": 0 }
      }
    },
    {
      "stepId": "uuid-9",
      "stepType": "publish_event",
      "stepName": "Publish rating event to Kafka",
      "status": "completed",
      "durationMs": 12
    }
  ],
  "totalDurationMs": 342
}
```

### Error Response Examples

**404 — No orchestrator configured:**
```json
{
  "statusCode": 404,
  "message": "No orchestrator found for product line 'UNKNOWN' endpoint 'rate'. Go to the Orchestrator tab and configure the flow first."
}
```

**200 with failed status — Step failure:**
```json
{
  "transactionId": "uuid",
  "correlationId": "uuid",
  "productLineCode": "IMCE",
  "status": "failed",
  "data": { "...partial working state up to failure point..." },
  "response": {},
  "stepResults": [
    { "stepId": "uuid-1", "status": "completed", "durationMs": 2 },
    { "stepId": "uuid-2", "status": "completed", "durationMs": 45 },
    { "stepId": "uuid-3", "status": "failed", "error": "Rules service unavailable", "durationMs": 30002 }
  ],
  "totalDurationMs": 30052
}
```

---

## How the Full IMCE Flow Executes (End-to-End Trace)

Reference: The IMCE product (Inland Marine Contractor Equipment) orchestrator shown in the UI with gw-policycenter → cgi-ratabase, 9 steps.

```
Caller → POST /api/v1/IMCE/rate
       { payload: { quoteNumber: "Q-123", insured: { state: "NY" }, premium: { base: 50000 } },
         scope: { state: "NY", coverage: "BOP", transactionType: "new_business" } }

1. PlatformApiController.rate()
   → ratingService.rate({ productLineCode: "IMCE", payload, scope })

2. RatingService.rate()
   a. Fetch flow: GET line-rating:4001/api/v1/orchestrators/IMCE/flow/rate → 9 steps
   b. Create tx: POST status-service:4013/api/v1/transactions → transactionId
   c. Execute: executionService.execute({ correlationId, productLineCode, scope, payload, steps })

3. ExecutionService.execute()
   context.working = { quoteNumber: "Q-123", insured: { state: "NY" }, premium: { base: 50000 } }

   Step 1: validate_request → ValidateRequestHandler
     Checks required fields per config
     context.working unchanged

   Step 2: field_mapping (direction=request) → FieldMappingHandler
     Fetches mapping from product-config:4010
     Applies field mappings: quoteNumber → policy.quoteId, etc.
     context.working = { policy: { quoteId: "Q-123" }, rating: { basePremium: 50000 }, ... }

   Step 3: apply_rules (scope=pre_rating) → ApplyRulesHandler
     POSTs to rules-service:4012/api/v1/rules/evaluate
     Rules apply surcharges, discounts, flags
     context.working.rating.basePremium = 57500 (after territory factor)

   Step 4: format_transform (json_to_xml) → FormatTransformHandler
     POSTs to transform-service:4011/api/v1/transform
     context.working = "<root><policy><quoteId>Q-123</quoteId>...</root>"

   Step 5: call_rating_engine (systemCode=cgi-ratabase) → CallRatingEngineHandler
     Fetches system config from product-config:4010/api/v1/systems
     POSTs XML to CGI Ratabase (or mock at /api/v1/mock/ratabase/rate)
     context.response = { premium: { final: 72000 }, ... }

   Step 6: format_transform (xml_to_json) → FormatTransformHandler
     Converts XML response back to JSON
     context.working = { policy: { quoteId: "Q-123" }, premium: { final: 72000 } }

   Step 7: field_mapping (direction=response) → FieldMappingHandler
     Applies response field mappings
     context.working = { quote: { totalPremium: 72000, referenceNumber: "Q-123" } }

   Step 8: apply_rules (scope=post_rating) → ApplyRulesHandler
     Post-rating rules (minimum premium floor, etc.)
     context.working unchanged (no rules triggered)

   Step 9: publish_event → PublishEventHandler
     POSTs to kafka-adapter:3010 (or logs if unavailable)

4. ExecutionResult returned with:
   - status: 'completed'
   - working: context.working (final transformed state)
   - response: context.response (engine output)
   - stepResults: [9 entries with timing]

5. RatingService updates transaction in status-service:
   PUT status-service:4013/api/v1/transactions/{id} with workingData + responsePayload
   POST step logs for each of the 9 steps

6. Response returned to caller with data, response, stepResults
```

---

## Phase 4 (Backlog): API Key Authentication

**Goal:** Secure the public platform API with API key authentication so external systems must present a valid key.

### Design

- API keys stored in a new `api_keys` database table (in product-config or a dedicated auth-service)
- Each key is scoped to one or more product lines
- Keys are passed via `X-API-Key` header or `Authorization: Bearer <key>`
- A NestJS Guard (`ApiKeyGuard`) validates the key before the controller method runs
- Guard is applied only to `PlatformApiController` — internal endpoints remain unauthenticated

### Database Schema

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256 hash of the actual key
  name VARCHAR(255) NOT NULL,               -- Human-readable label
  product_line_codes TEXT[] DEFAULT '{}',    -- Array of allowed product codes, empty = all
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INT DEFAULT 60,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,                     -- NULL = never expires
  last_used_at TIMESTAMP
);
```

### Key Format

`rp_live_<32-char-random-hex>` — prefix makes it easy to identify and scan for leaked keys.

### Guard Implementation

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || extractBearerToken(request);
    if (!apiKey) throw new UnauthorizedException('Missing API key');

    const keyHash = sha256(apiKey);
    const record = await this.apiKeyRepo.findOne({ where: { keyHash, isActive: true } });
    if (!record) throw new UnauthorizedException('Invalid API key');
    if (record.expiresAt && record.expiresAt < new Date()) throw new UnauthorizedException('API key expired');

    // Check product scope
    const productCode = request.params.productCode;
    if (record.productLineCodes.length > 0 && !record.productLineCodes.includes(productCode)) {
      throw new ForbiddenException(`API key not authorized for product ${productCode}`);
    }

    // Update last_used_at (async, don't block response)
    this.apiKeyRepo.update(record.id, { lastUsedAt: new Date() }).catch(() => {});

    // Attach to request for downstream use
    request['apiKey'] = record;
    return true;
  }
}
```

### Files

| File | Action |
|---|---|
| `db/migrations/XXX_api_keys.sql` | Create (new table) |
| `orchestrators/core-rating/src/guards/api-key.guard.ts` | Create |
| `orchestrators/core-rating/src/platform-api/platform-api.controller.ts` | Edit (add `@UseGuards(ApiKeyGuard)`) |
| Admin UI for key management (frontend) | Create (new page) |

---

## Phase 5 (Backlog): Rate Limiting

**Goal:** Prevent abuse by limiting request volume per API key.

### Design

- Use Redis (already available in infra: port 6380 locally) for sliding window counters
- Key: `rate_limit:{apiKeyId}:{minute_bucket}`
- Limit from `api_keys.rate_limit_per_minute` (default: 60)
- Return `429 Too Many Requests` with `Retry-After` header when exceeded

### Implementation

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request['apiKey'];  // Set by ApiKeyGuard
    if (!apiKey) return true;  // No key = no rate limit (internal calls)

    const bucket = `rate_limit:${apiKey.id}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.redis.incr(bucket);
    if (count === 1) await this.redis.expire(bucket, 120);  // TTL = 2 minutes

    if (count > apiKey.rateLimitPerMinute) {
      throw new HttpException(
        { statusCode: 429, message: 'Rate limit exceeded', retryAfter: 60 },
        429,
      );
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', apiKey.rateLimitPerMinute);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, apiKey.rateLimitPerMinute - count));

    return true;
  }
}
```

### Guard Order on PlatformApiController

```typescript
@Controller(':productCode')
@UseGuards(ApiKeyGuard, RateLimitGuard)  // Auth first, then rate limit
export class PlatformApiController { ... }
```

---

## Phase 6 (Backlog): Request/Response Schema Validation Per Product

**Goal:** Validate incoming payloads against product-specific JSON schemas before executing the pipeline.

### Design

- Each product line can define a JSON schema for its request payload
- Schema stored in product-config as part of the product line configuration
- A new `ValidateSchemaInterceptor` on `PlatformApiController` validates the body against the schema
- Returns `400 Bad Request` with detailed validation errors if invalid

### Schema Storage

Add to `product_lines` table (or a new `product_schemas` table):

```sql
ALTER TABLE product_lines
  ADD COLUMN request_schema JSONB,    -- JSON Schema for request payload
  ADD COLUMN response_schema JSONB;   -- JSON Schema for expected response (for documentation)
```

### Schema Example

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["payload"],
  "properties": {
    "payload": {
      "type": "object",
      "required": ["quoteNumber", "insured"],
      "properties": {
        "quoteNumber": { "type": "string", "pattern": "^Q-\\d+$" },
        "insured": {
          "type": "object",
          "required": ["state"],
          "properties": {
            "state": { "type": "string", "minLength": 2, "maxLength": 2 }
          }
        }
      }
    },
    "scope": {
      "type": "object",
      "properties": {
        "state": { "type": "string" },
        "coverage": { "type": "string" },
        "transactionType": { "type": "string", "enum": ["new_business", "renewal", "endorsement"] }
      }
    }
  }
}
```

### Validation Error Response

```json
{
  "statusCode": 400,
  "message": "Request validation failed",
  "errors": [
    { "path": "/payload/quoteNumber", "message": "must match pattern ^Q-\\d+$" },
    { "path": "/payload/insured/state", "message": "must NOT have fewer than 2 characters" }
  ]
}
```

### Library

Use `ajv` (Already JSON Schema Validator) — lightweight, fast, supports JSON Schema 2020-12.

---

## Phase 7 (Backlog): OpenAPI / Swagger Documentation

**Goal:** Auto-generate interactive API documentation for the platform API.

### Design

- Use `@nestjs/swagger` module
- Add decorators to `PlatformApiController` and DTOs
- Serve Swagger UI at `/api/docs`
- Generate OpenAPI JSON at `/api/docs-json`

### Implementation

```typescript
// main.ts — add after app creation
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('InsuRateConnect Platform API')
  .setDescription('Rating platform public API for external system integration')
  .setVersion('1.0')
  .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
  .addTag('Rating', 'Execute rating flows for insurance products')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

### DTO Decorators

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateRequestDto {
  @ApiProperty({ description: 'The data payload to rate', example: { quoteNumber: 'Q-123' } })
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Scope filters for rules and mappings' })
  scope?: { state?: string; coverage?: string; transactionType?: string };
}
```

---

## Phase 8 (Backlog): Webhook Notifications

**Goal:** Allow external systems to register webhooks for async notifications when rating completes.

### Use Case

Long-running rating flows (e.g., calling slow external engines) can take several seconds. Instead of holding the HTTP connection, the caller can:
1. POST to `/api/v1/IMCE/rate` with `"async": true` and `"webhookUrl": "https://their-system.com/callback"`
2. Receive an immediate `202 Accepted` with `transactionId`
3. Get a POST to their webhook URL when the rating completes

### Request

```json
{
  "payload": { ... },
  "scope": { ... },
  "async": true,
  "webhookUrl": "https://partner-system.example.com/rating-callback",
  "webhookHeaders": { "Authorization": "Bearer their-token" }
}
```

### Immediate Response (202)

```json
{
  "transactionId": "uuid",
  "correlationId": "uuid",
  "status": "processing",
  "message": "Rating request accepted. Results will be delivered to webhook."
}
```

### Webhook Payload (POST to their URL when done)

```json
{
  "event": "rating.completed",
  "transactionId": "uuid",
  "correlationId": "uuid",
  "productLineCode": "IMCE",
  "status": "completed",
  "data": { ... },
  "response": { ... },
  "totalDurationMs": 342,
  "completedAt": "2026-02-25T15:30:00Z"
}
```

---

## Phase 9 (Backlog): Multi-Product Batch Rating

**Goal:** Accept multiple rating requests in a single API call for batch processing.

### Endpoint

```
POST /api/v1/batch/rate
```

### Request

```json
{
  "requests": [
    { "productLineCode": "IMCE", "payload": { ... }, "scope": { ... } },
    { "productLineCode": "GL", "payload": { ... }, "scope": { ... } },
    { "productLineCode": "IMCE", "payload": { ... }, "scope": { ... } }
  ],
  "parallel": true
}
```

### Response

```json
{
  "batchId": "uuid",
  "results": [
    { "index": 0, "transactionId": "uuid", "status": "completed", "data": { ... } },
    { "index": 1, "transactionId": "uuid", "status": "failed", "error": "..." },
    { "index": 2, "transactionId": "uuid", "status": "completed", "data": { ... } }
  ],
  "summary": { "total": 3, "completed": 2, "failed": 1 },
  "totalDurationMs": 850
}
```

---

## Backlog Priority Summary

| Phase | Feature | Priority | Effort | Dependencies |
|---|---|---|---|---|
| **1** | Expose `working` in ExecutionResult | **P0 — Do Now** | Small | None |
| **2** | Surface `data` in RateResponse | **P0 — Do Now** | Small | Phase 1 |
| **3** | PlatformApiModule + Controller | **P0 — Do Now** | Small | Phase 2 |
| **4** | API Key Authentication | **P1 — Next** | Medium | Phase 3 |
| **5** | Rate Limiting | **P1 — Next** | Small | Phase 4 (needs API key) |
| **6** | Request Schema Validation | **P2 — Soon** | Medium | Phase 3 |
| **7** | OpenAPI/Swagger Docs | **P2 — Soon** | Small | Phase 3 |
| **8** | Webhook Notifications | **P3 — Later** | Large | Phase 3 |
| **9** | Batch Rating API | **P3 — Later** | Large | Phase 3 |

---

## Reserved Product Codes

The following product codes must NOT be used as they would conflict with existing routes:

| Reserved Code | Reason |
|---|---|
| `health` | Conflicts with `GET /api/v1/health` |
| `rate` | Conflicts with `POST /api/v1/rate/:productLineCode` |
| `execute` | Conflicts with `POST /api/v1/execute` |
| `registry` | Conflicts with `GET /api/v1/registry/handlers` |
| `mock` | Conflicts with mock system endpoints |
| `batch` | Reserved for future batch rating endpoint |
| `docs` | Reserved for Swagger UI |

A validation check in product-config's product creation endpoint should reject these codes.
