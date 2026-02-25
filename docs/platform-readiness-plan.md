# Platform Readiness — Architecture, Performance, Scaling & Governance

## Overview

This document covers everything needed to evolve the rating platform from an internal tool into a production-grade platform that multiple product lines, external systems, and partner organizations can rely on — including large and variable payload sizes (1 MB to 50 MB+), high concurrency, and strict operational requirements.

**Companion documents:**
- `docs/live-orchestration-api-plan.md` — Public API + working data visibility
- `docs/mapping-and-rules-enhancement-plan.md` — Transformation engine + rules enhancements

---

## Current Infrastructure Baseline

### Compute (ECS Fargate)

| Service | CPU | Memory | Desired Count | Service Discovery |
|---|---|---|---|---|
| core-rating | 512m (0.5 vCPU) | 1024 MB | 2 | core-rating.rating-platform.local:4000 |
| line-rating | 256m (0.25 vCPU) | 512 MB | 2 | line-rating.rating-platform.local:4001 |
| product-config | 256m (0.25 vCPU) | 512 MB | 2 | product-config.rating-platform.local:4010 |
| transform-service | 256m (0.25 vCPU) | 512 MB | 2 | transform-service.rating-platform.local:4011 |
| rules-service | 512m (0.5 vCPU) | 1024 MB | 2 | rules-service.rating-platform.local:4012 |
| status-service | 256m (0.25 vCPU) | 512 MB | 2 | status-service.rating-platform.local:4013 |
| adapter-kafka | 256m (0.25 vCPU) | 512 MB | 2 | adapter-kafka.rating-platform.local:3010 |
| adapter-dnb | 256m (0.25 vCPU) | 512 MB | 2 | adapter-dnb.rating-platform.local:3011 |
| adapter-gw | 256m (0.25 vCPU) | 512 MB | 2 | adapter-gw.rating-platform.local:3012 |
| rating-workspace | 256m (0.25 vCPU) | 512 MB | 2 | (Nginx static) |

### Database (RDS PostgreSQL 16)

| Setting | Current Value |
|---|---|
| Instance class | db.t3.micro (2 vCPU burst, 1 GB RAM) |
| Storage | 20 GB, gp2 |
| Multi-AZ | false (dev) |
| Backup retention | 7 days |
| Encryption | AES-256 at rest |
| Performance Insights | Enabled |
| Connection pool (TypeORM) | Default (min: 2, max: 10) |

### Network

| Component | Configuration |
|---|---|
| ALB idle timeout | 60 seconds (default) |
| ALB health check interval | 30 seconds |
| ALB deregistration delay | 300 seconds (default) |
| Service discovery DNS TTL | 10 seconds |
| TLS policy | ELBSecurityPolicy-TLS13-1-2-2021-06 |

### What's Missing Today

| Area | Gap |
|---|---|
| Auto-scaling | None — static 2 tasks per service |
| Request payload limits | None — Express defaults to unlimited |
| Request timeouts | No NestJS-level timeout; ALB 60s idle |
| Compression | None — responses sent uncompressed |
| Connection pooling | TypeORM defaults (max 10) |
| Rate limiting | None |
| Caching | Redis running but not integrated |
| Monitoring/alerting | CloudWatch logs only, no metrics or alarms |
| Body size enforcement | None — 50 MB payload would be accepted |

---

## Section 1: Performance & Payload Handling

### The Problem

Different product lines have vastly different payload sizes:

| Product Type | Typical Payload | Example |
|---|---|---|
| Simple BOP / GL | 1–10 KB | Basic business info + coverage limits |
| Workers' Comp (multi-state) | 50–200 KB | Employee class codes, state breakdowns |
| Commercial Package | 200 KB – 2 MB | Multiple coverages, locations, vehicles |
| Inland Marine (IMCE) | 1–5 MB | Equipment schedules with thousands of items |
| Large Fleet Auto | 5–20 MB | Vehicle lists, driver records |
| Reinsurance / Treaty | 20–50 MB+ | Historical loss data, exposure schedules |

A 50 MB payload flowing through 9 orchestration steps means:
- 50 MB parsed into `context.working` (in-memory)
- Each handler receives and returns the full context
- Field mapping iterates over potentially thousands of fields
- Rules evaluation checks conditions against deeply nested objects
- JSON → XML conversion doubles memory (XML is larger than JSON)
- Inter-service HTTP calls transmit the full payload each time

### 1a. Request Payload Size Limits (Per Product)

**Problem:** NestJS/Express has no body size limit by default. A 50 MB request will be accepted, buffered into memory, and could crash a 512 MB container.

**Solution:** Tiered payload limits based on product configuration.

**File:** Every `main.ts` file for each service

```typescript
// Global default — applies to all services
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Default: 10 MB for most services
  app.use(json({ limit: '10mb' }));

  // ...
}
```

**File:** `orchestrators/core-rating/src/main.ts` — core-rating needs higher limits since it's the entry point

```typescript
// Core-rating: higher limit for large payloads
app.use(json({ limit: '60mb' }));
```

**Per-product override:** Add `maxPayloadBytes` to the product line configuration in product-config:

```sql
ALTER TABLE product_lines
  ADD COLUMN max_payload_bytes BIGINT DEFAULT 10485760;  -- 10 MB default
```

Then in `RatingService.rate()`, before executing:
```typescript
const payloadSize = Buffer.byteLength(JSON.stringify(request.payload));
if (payloadSize > productLine.maxPayloadBytes) {
  throw new PayloadTooLargeException(
    `Payload size ${(payloadSize / 1048576).toFixed(1)} MB exceeds limit of ${(productLine.maxPayloadBytes / 1048576).toFixed(1)} MB for product ${request.productLineCode}`
  );
}
```

### 1b. Streaming for Large Payloads

**Problem:** For 20–50 MB payloads, buffering the entire body into memory is wasteful. The inter-service calls (core-rating → rules-service, core-rating → transform-service) also buffer full payloads.

**Solution (Phase 2):** Stream large payloads to/from S3 (MinIO locally) and pass references.

```
Caller → POST /api/v1/IMCE/rate (50 MB body)
       ↓
Core-rating receives body, streams to S3: s3://rating-payloads/{correlationId}/request.json
       ↓
context.working = { _payloadRef: "s3://...", _payloadSize: 52428800 }
       ↓
FieldMappingHandler: downloads from S3, processes, uploads result to S3
       ↓
ApplyRulesHandler: downloads from S3, evaluates, uploads modified state
       ↓
...each handler streams from/to S3 instead of passing 50 MB in HTTP bodies
```

**Threshold:** Payloads under 5 MB use in-memory (current behavior). Payloads over 5 MB use S3 streaming.

**S3 bucket:** `rating-platform-payloads` with 24-hour lifecycle policy (auto-delete).

### 1c. Response Compression

**Problem:** A 5 MB JSON response takes 5× longer to transmit than a compressed version.

**Solution:** Enable gzip compression in NestJS.

**File:** Every `main.ts`

```typescript
import compression from 'compression';

app.use(compression({
  threshold: 1024,     // Only compress responses > 1 KB
  level: 6,            // Balanced speed/compression ratio
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));
```

**Impact:** JSON compresses ~80-90%. A 5 MB response becomes ~500 KB–1 MB over the wire.

### 1d. Request Timeout Configuration

**Problem:** No request-level timeouts in NestJS. A stuck rules-service call holds the connection for the full ALB idle timeout (60s), consuming a task's resources.

**Current timeouts:**
- Axios calls to other services: 30 seconds (handler-level)
- ALB idle timeout: 60 seconds
- NestJS: No timeout (inherits Node.js default ~2 minutes)

**Solution:** Add a global timeout interceptor.

```typescript
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const timeout = context.switchToHttp().getRequest()['_timeout'] || 55000; // 55s default (under ALB 60s)
    return next.handle().pipe(
      timeout(timeout),
      catchError(err => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('Request timed out');
        }
        throw err;
      }),
    );
  }
}
```

**Per-product timeout:** Add `timeoutMs` to product line config. Complex products (reinsurance) might need 120s, simple BOP might need 10s.

### 1e. Connection Pool Tuning

**Problem:** TypeORM defaults to max 10 connections. Under load, services queue up waiting for connections.

**Solution:** Configure pool per service based on its workload.

| Service | Pool Min | Pool Max | Idle Timeout | Rationale |
|---|---|---|---|---|
| product-config | 5 | 20 | 30s | High read volume (mapping/rule lookups) |
| rules-service | 5 | 20 | 30s | High read volume during evaluation |
| status-service | 5 | 30 | 30s | High write volume (transaction + step logs) |
| line-rating | 2 | 10 | 60s | Low volume (flow definition reads) |

```typescript
TypeOrmModule.forRoot({
  // ... existing config
  extra: {
    min: parseInt(process.env['DB_POOL_MIN'] || '5'),
    max: parseInt(process.env['DB_POOL_MAX'] || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,  // Kill queries running > 30s
  },
});
```

### 1f. Redis Caching Layer

**Problem:** Every rating request fetches orchestrator steps, mappings, and rules from the database via HTTP. These rarely change but are fetched on every request.

**Solution:** Cache frequently-read, rarely-changed data in Redis.

| Data | Cache Key | TTL | Invalidation |
|---|---|---|---|
| Orchestrator flow (steps) | `flow:{productCode}:{endpoint}` | 5 min | On flow save in UI |
| Mapping definitions | `mapping:{mappingId}` | 5 min | On mapping save |
| Field mappings | `fields:{mappingId}` | 5 min | On field save |
| Active rules for product | `rules:{productCode}:{phase}` | 2 min | On rule save/activate |
| System configs | `systems:all` | 10 min | On system save |

**Cache invalidation:** Publish cache-bust events via Redis pub/sub when any configuration changes in product-config, line-rating, or rules-service.

**Impact estimate:** Reduces inter-service HTTP calls from ~6-8 per rating request to ~1-2 (only for uncached or expired data). Latency reduction: 50-100ms per cached call avoided.

---

## Section 2: Auto-Scaling

### 2a. ECS Service Auto-Scaling

**Problem:** All services are static at 2 tasks. A burst of 100 concurrent rating requests will overwhelm core-rating (0.5 vCPU, 1 GB RAM × 2 tasks).

**Solution:** Target tracking auto-scaling per service.

```hcl
# infra/terraform/autoscaling.tf

resource "aws_appautoscaling_target" "core_rating" {
  max_capacity       = 10
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.core_rating.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "core_rating_cpu" {
  name               = "core-rating-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.core_rating.resource_id
  scalable_dimension = aws_appautoscaling_target.core_rating.scalable_dimension
  service_namespace  = aws_appautoscaling_target.core_rating.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300   # 5 min before scaling down
    scale_out_cooldown = 60    # 1 min before scaling up again
  }
}
```

**Scaling parameters per service:**

| Service | Min | Max | CPU Target | Memory Target | Scale-out Cooldown |
|---|---|---|---|---|---|
| core-rating | 2 | 10 | 70% | 80% | 60s |
| rules-service | 2 | 8 | 70% | 80% | 60s |
| product-config | 2 | 6 | 70% | — | 120s |
| transform-service | 2 | 8 | 70% | 80% | 60s |
| status-service | 2 | 6 | — | 70% | 120s |
| line-rating | 2 | 4 | 70% | — | 120s |

**Why different limits:** Core-rating and rules-service are the hot path (every request hits them). Product-config and status-service are supporting services with lower burst requirements.

### 2b. RDS Scaling

**Problem:** db.t3.micro has 2 vCPU (burstable) and 1 GB RAM. Under sustained load, CPU credits deplete and performance collapses.

**Solution — Vertical (immediate):**

| Environment | Instance Class | vCPU | RAM | Max Connections | IOPS |
|---|---|---|---|---|---|
| Dev | db.t3.micro | 2 (burst) | 1 GB | ~85 | Burst 3000 |
| Staging | db.t3.medium | 2 (burst) | 4 GB | ~150 | Burst 3000 |
| Production | db.r6g.large | 2 (dedicated) | 16 GB | ~400 | Up to 12,000 |
| Production (high) | db.r6g.xlarge | 4 (dedicated) | 32 GB | ~800 | Up to 16,000 |

**Solution — Read replicas (future):**
- 1 read replica for product-config reads (mapping/rule lookups)
- Primary for writes (status-service transaction inserts)
- TypeORM supports read/write splitting via `replication` config

### 2c. Redis Scaling

**Problem:** Local Redis is a single instance. In production, need HA and capacity for caching + rate limiting.

**Solution:** AWS ElastiCache (Redis 7, cluster mode)

```hcl
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "rating-platform-redis"
  engine               = "redis"
  node_type            = "cache.t3.medium"  # 2 vCPU, 3.09 GB
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  security_group_ids   = [aws_security_group.redis.id]
  subnet_group_name    = aws_elasticache_subnet_group.main.name

  # For HA: use replication group instead
}
```

| Environment | Node Type | Nodes | Memory | Use |
|---|---|---|---|---|
| Dev | Local Redis | 1 | 256 MB | Dev caching |
| Staging | cache.t3.small | 1 | 1.5 GB | Caching + rate limiting |
| Production | cache.r6g.large | 2 (primary + replica) | 13 GB | Caching + rate limiting + sessions |

### 2d. ALB Scaling

ALB scales automatically (AWS-managed), but we should tune:

```hcl
resource "aws_lb" "main" {
  # ... existing config

  idle_timeout = 120    # Increase from 60s for large payload processing

  # Enable HTTP/2 for multiplexed connections
  enable_http2 = true
}

# Increase deregistration delay for graceful shutdown
resource "aws_lb_target_group" "core_rating" {
  # ... existing config
  deregistration_delay = 30  # Reduce from 300s to 30s for faster deployments

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400  # Not needed for stateless API, but useful for WebSocket
    enabled         = false
  }
}
```

---

## Section 3: Multi-Tenancy & Organization Isolation

### The Problem

Currently, all product lines, mappings, rules, and API keys live in a flat namespace. If two insurance carriers both use the platform, Carrier A can see Carrier B's products.

### 3a. Tenant Model

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,          -- e.g., 'acme-insurance'
  status VARCHAR(20) DEFAULT 'active',        -- active, suspended, deactivated
  plan VARCHAR(50) DEFAULT 'standard',        -- standard, professional, enterprise
  settings JSONB DEFAULT '{}',                -- org-level config overrides
  max_products INT DEFAULT 10,
  max_api_keys INT DEFAULT 5,
  max_payload_bytes BIGINT DEFAULT 10485760,  -- 10 MB default
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add org_id to all existing tables
ALTER TABLE product_lines ADD COLUMN org_id UUID REFERENCES organizations(id);
ALTER TABLE api_keys ADD COLUMN org_id UUID REFERENCES organizations(id);
-- ... etc for rules, mappings, orchestrators
```

### 3b. Tenant Resolution

Options (in order of preference):
1. **From API key** — the API key is scoped to an org; every authenticated request inherits the org
2. **From subdomain** — `acme.insurratex.com` resolves to org `acme-insurance`
3. **From header** — `X-Organization-Id: uuid` (for internal/admin use)

### 3c. Data Isolation

Every database query includes `WHERE org_id = :orgId`:

```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const orgId = request['apiKey']?.orgId || request.headers['x-organization-id'];
    request['tenantId'] = orgId;
    return next.handle();
  }
}
```

TypeORM subscriber or global scope to auto-filter:
```typescript
// Every repository query automatically includes org_id filter
queryBuilder.andWhere('entity.org_id = :orgId', { orgId: request.tenantId });
```

### 3d. Tenant-Level Resource Limits

| Resource | Standard Plan | Professional | Enterprise |
|---|---|---|---|
| Products | 10 | 50 | Unlimited |
| API keys | 5 | 20 | Unlimited |
| Rules per product | 50 | 200 | Unlimited |
| Mappings per product | 20 | 100 | Unlimited |
| Max payload | 10 MB | 50 MB | 100 MB |
| Rate limit (req/min) | 60 | 300 | Custom |
| Transaction retention | 30 days | 90 days | 1 year |

---

## Section 4: API Versioning

### 4a. URL-Based Versioning (Current)

Current: `/api/v1/*` — hardcoded in `main.ts` as global prefix.

**Strategy for v2:**

```typescript
// main.ts
app.setGlobalPrefix('api');  // Remove version from global prefix

// Controllers use version decorator
@Controller({ path: 'rate', version: '1' })     // → /api/v1/rate
export class RatingControllerV1 { ... }

@Controller({ path: 'rate', version: '2' })     // → /api/v2/rate
export class RatingControllerV2 { ... }
```

Enable versioning in NestJS:
```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});
```

### 4b. Deprecation Policy

- v1 continues working for 12 months after v2 launch
- Deprecated endpoints return `Sunset` and `Deprecation` headers:
  ```
  Sunset: Sat, 01 Mar 2027 00:00:00 GMT
  Deprecation: true
  Link: </api/v2/rate>; rel="successor-version"
  ```
- v1 requests logged with `deprecated=true` tag for tracking migration progress

### 4c. Per-Consumer Version Pinning

API keys can be pinned to a version:
```sql
ALTER TABLE api_keys ADD COLUMN api_version VARCHAR(10) DEFAULT 'v1';
```

When a key is pinned to v1, calls to `/api/v2/` are rejected. Forces explicit opt-in to breaking changes.

---

## Section 5: Flow Versioning & Promotion

### 5a. Flow Version History

```sql
CREATE TABLE orchestrator_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestrator_id UUID NOT NULL REFERENCES product_orchestrators(id),
  version INT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft',          -- draft, published, archived
  steps JSONB NOT NULL,                         -- Snapshot of all steps at this version
  published_by VARCHAR(100),
  published_at TIMESTAMP,
  change_description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(orchestrator_id, version)
);
```

### 5b. Promotion Workflow

```
Draft (editable in UI)
  ↓ Publish
Published (immutable, used by /rate endpoint)
  ↓ New version created
Archived (kept for audit, rollback)
```

- The `/rate` endpoint always uses the **latest published version**
- Editing in the UI creates a new draft version (doesn't touch published)
- Publishing makes the draft the new active version
- Rollback = re-publish an older archived version

### 5c. Environment Promotion (Future)

```
Dev environment → Staging → Production
```

Export flow as JSON → import into next environment. Or use Git-based promotion where flow configs are committed and deployed via CI/CD.

---

## Section 6: Idempotency

### 6a. Idempotency Key Header

```
POST /api/v1/IMCE/rate
X-Idempotency-Key: client-generated-uuid-123
```

### 6b. Implementation

```typescript
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-idempotency-key'];
    if (!key) return next.handle();  // No key = no idempotency

    const cacheKey = `idempotency:${key}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      // Return cached response — don't re-execute
      const response = context.switchToHttp().getResponse();
      response.setHeader('X-Idempotent-Replayed', 'true');
      return of(JSON.parse(cached));
    }

    return next.handle().pipe(
      tap(async (result) => {
        // Cache result for 24 hours
        await this.redis.setex(cacheKey, 86400, JSON.stringify(result));
      }),
    );
  }
}
```

### 6c. Behavior

| Scenario | Behavior |
|---|---|
| First request with key | Execute normally, cache result |
| Duplicate request with same key (within 24h) | Return cached result, header `X-Idempotent-Replayed: true` |
| Same key after 24h | Execute again (key expired) |
| No key header | No idempotency (current behavior) |
| Request with key but different body | Return cached result from first request (key is the identifier, not the body) |

---

## Section 7: Standardized Error Taxonomy

### 7a. Error Envelope

Every error response follows the same structure:

```json
{
  "error": {
    "code": "ORCHESTRATOR_NOT_FOUND",
    "message": "No orchestrator found for product line 'UNKNOWN' endpoint 'rate'.",
    "details": {
      "productLineCode": "UNKNOWN",
      "endpointPath": "rate"
    },
    "correlationId": "uuid",
    "timestamp": "2026-02-25T15:30:00.000Z",
    "documentation": "https://docs.insurratex.com/errors/ORCHESTRATOR_NOT_FOUND"
  }
}
```

### 7b. Error Code Catalog

| Code | HTTP Status | Description |
|---|---|---|
| `ORCHESTRATOR_NOT_FOUND` | 404 | No flow configured for this product + endpoint |
| `NO_STEPS_CONFIGURED` | 404 | Orchestrator exists but has no active steps |
| `STEP_EXECUTION_FAILED` | 200 (status=failed) | A step in the pipeline failed |
| `STEP_HANDLER_NOT_FOUND` | 500 | Step type has no registered handler |
| `PAYLOAD_TOO_LARGE` | 413 | Payload exceeds product's max size |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests for this API key |
| `API_KEY_INVALID` | 401 | Missing or invalid API key |
| `API_KEY_EXPIRED` | 401 | API key has expired |
| `API_KEY_PRODUCT_DENIED` | 403 | API key not authorized for this product |
| `VALIDATION_FAILED` | 400 | Request body fails schema validation |
| `MAPPING_SERVICE_UNAVAILABLE` | 503 | Cannot reach product-config for mappings |
| `RULES_SERVICE_UNAVAILABLE` | 503 | Cannot reach rules-service |
| `RATING_ENGINE_UNAVAILABLE` | 503 | Cannot reach external rating engine |
| `TRANSFORM_SERVICE_UNAVAILABLE` | 503 | Cannot reach transform-service |
| `REQUEST_TIMEOUT` | 408 | Request exceeded configured timeout |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### 7c. Global Exception Filter

```typescript
@Catch()
export class PlatformExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const { status, code, message, details } = this.mapException(exception);

    response.status(status).json({
      error: {
        code,
        message,
        details,
        correlationId: request.headers['x-correlation-id'] || request['correlationId'],
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

---

## Section 8: Observability

### 8a. Distributed Tracing (OpenTelemetry)

**Problem:** A single `/rate` call touches 5+ services. When latency spikes, you can't tell which service is slow.

**Solution:** OpenTelemetry SDK with X-Ray exporter (AWS native).

```typescript
// tracing.ts — loaded before NestJS bootstrap
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AWSXRayIdGenerator } from '@opentelemetry/id-generator-aws-xray';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  idGenerator: new AWSXRayIdGenerator(),
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
  ],
});

sdk.start();
```

**Trace propagation:** The `x-correlation-id` header already flows through all services. Map this to W3C `traceparent` for OTel compatibility.

### 8b. Metrics (Prometheus + CloudWatch)

**Custom metrics to track:**

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `rating_request_total` | Counter | product, flow, status | Request volume |
| `rating_request_duration_seconds` | Histogram | product, flow | End-to-end latency |
| `rating_step_duration_seconds` | Histogram | product, step_type, step_name | Per-step latency |
| `rating_payload_size_bytes` | Histogram | product, direction (in/out) | Payload size distribution |
| `rating_rules_evaluated_total` | Counter | product, phase | Rules evaluation volume |
| `rating_rules_applied_total` | Counter | product, phase | Rules that actually fired |
| `rating_mapping_fields_applied` | Counter | product, direction | Fields successfully mapped |
| `rating_engine_call_duration_seconds` | Histogram | engine, is_mock | External engine latency |
| `rating_cache_hit_total` | Counter | cache_key_type | Cache effectiveness |
| `rating_cache_miss_total` | Counter | cache_key_type | Cache misses |
| `db_pool_active_connections` | Gauge | service | Connection pool utilization |
| `db_pool_waiting_requests` | Gauge | service | Connection pool saturation |

### 8c. Health Check Enhancement

**Current:** `GET /api/v1/health` returns `{ status: 'ok', service: 'core-rating', timestamp: '...' }`

**Enhanced:**

```json
GET /api/v1/health

{
  "status": "healthy",
  "service": "core-rating",
  "version": "1.2.3",
  "uptime": 86400,
  "timestamp": "2026-02-25T15:30:00Z",
  "dependencies": {
    "line-rating": { "status": "healthy", "latencyMs": 12 },
    "product-config": { "status": "healthy", "latencyMs": 8 },
    "rules-service": { "status": "healthy", "latencyMs": 15 },
    "transform-service": { "status": "healthy", "latencyMs": 5 },
    "status-service": { "status": "healthy", "latencyMs": 10 },
    "database": { "status": "healthy", "poolActive": 3, "poolMax": 20 },
    "redis": { "status": "healthy", "memoryUsedMb": 45 }
  },
  "circuitBreakers": {
    "cgi-ratabase": { "state": "closed", "failures": 0 },
    "earnix": { "state": "open", "openedAt": "2026-02-25T15:25:00Z", "resetsAt": "2026-02-25T15:30:00Z" }
  }
}
```

**Kubernetes probes:**
- **Liveness:** `/api/v1/health/live` — returns 200 if process is running (no dependency checks)
- **Readiness:** `/api/v1/health/ready` — returns 200 only if all critical dependencies are reachable

### 8d. Alerting Rules

| Alert | Condition | Severity | Action |
|---|---|---|---|
| High error rate | >5% of requests fail (5-min window) | Critical | Page on-call |
| High latency | P95 > 5 seconds (5-min window) | Warning | Slack notification |
| Circuit breaker open | Any engine circuit breaker trips | Warning | Slack notification |
| DB connection pool exhausted | Active = Max for >1 min | Critical | Page on-call |
| ECS task unhealthy | Any task fails health check | Warning | Auto-replaced by ECS |
| RDS CPU > 80% | Sustained >5 min | Warning | Consider scaling |
| Disk space > 80% | RDS storage utilization | Warning | Increase storage |
| Zero traffic | No requests for >10 min (business hours) | Info | Investigate |

---

## Section 9: Audit Trail & Compliance

### 9a. Configuration Change Audit

**Problem:** No record of who changed a mapping, rule, or orchestrator flow.

**Solution:** Audit log table capturing every write operation:

```sql
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  org_id UUID,
  user_id VARCHAR(100),                   -- API key ID or user email
  action VARCHAR(50) NOT NULL,            -- CREATE, UPDATE, DELETE, ACTIVATE, PUBLISH
  entity_type VARCHAR(50) NOT NULL,       -- product_line, mapping, rule, orchestrator, api_key
  entity_id UUID NOT NULL,
  entity_name VARCHAR(255),
  changes JSONB,                          -- { before: {...}, after: {...} }
  ip_address INET,
  user_agent TEXT,
  correlation_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
```

### 9b. Immutable Transaction Log

The status-service already stores transactions. Enhance for compliance:

```sql
ALTER TABLE transactions
  ADD COLUMN request_hash VARCHAR(64),    -- SHA-256 of original request (tamper detection)
  ADD COLUMN working_data JSONB,          -- Final working state (from Phase 2 of orchestration plan)
  ADD COLUMN api_key_id UUID,             -- Which API key was used
  ADD COLUMN org_id UUID;                 -- Which org made the request
```

### 9c. Data Retention & Archival

| Data Type | Hot Storage (DB) | Warm Storage (S3) | Cold Storage (Glacier) |
|---|---|---|---|
| Transactions | 90 days | 1 year | 7 years |
| Step logs | 90 days | 1 year | 7 years |
| Audit log | 1 year | 7 years | — |
| Large payloads (S3) | 24 hours | 90 days | 1 year |
| Configuration snapshots | Current + previous 10 versions | All versions | — |

Automated archival via scheduled Lambda or ECS task running nightly.

---

## Section 10: Configuration as Code

### 10a. Export Endpoint

```
GET /api/v1/products/{productCode}/export
```

Returns the complete product configuration as a single JSON document:

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2026-02-25T15:30:00Z",
  "productLine": {
    "code": "IMCE",
    "name": "Inland Marine Contractor Equipment",
    "description": "...",
    "sourceSystem": "gw-policycenter",
    "targetSystem": "cgi-ratabase"
  },
  "orchestrators": [
    {
      "endpointPath": "rate",
      "name": "IMCE Rating Flow",
      "steps": [ ... ]
    }
  ],
  "mappings": [
    {
      "name": "IMCE Request Mapping",
      "direction": "request",
      "fields": [ ... ]
    }
  ],
  "rules": [
    {
      "name": "NY Building Age Surcharge",
      "conditions": [ ... ],
      "actions": [ ... ],
      "scopeTags": [ ... ]
    }
  ],
  "scopes": [ ... ]
}
```

### 10b. Import Endpoint

```
POST /api/v1/products/import
Content-Type: application/json

{ ...exported JSON... }
```

Behavior:
- If product code exists: update in place (with confirmation flag `"overwrite": true`)
- If product code doesn't exist: create new product with all configuration
- Validates all references (system codes, scope types) before importing
- Returns diff of what will change (dry-run mode with `"dryRun": true`)

### 10c. Git-Based Workflow (Future)

```
Product team edits config in Git (YAML/JSON files)
  ↓ PR merged
CI/CD pipeline calls /import endpoint
  ↓
Configuration deployed to target environment
```

---

## Section 11: Performance Benchmarks & Targets

### Target SLAs by Product Tier

| Metric | Simple (<10 KB) | Medium (10 KB–1 MB) | Large (1–10 MB) | Extra Large (10–50 MB) |
|---|---|---|---|---|
| P50 latency | < 200ms | < 500ms | < 2s | < 10s |
| P95 latency | < 500ms | < 1.5s | < 5s | < 30s |
| P99 latency | < 1s | < 3s | < 10s | < 60s |
| Throughput | 100 req/s | 50 req/s | 10 req/s | 2 req/s |
| Availability | 99.9% | 99.9% | 99.5% | 99.5% |
| Error rate | < 0.1% | < 0.5% | < 1% | < 2% |

### Bottleneck Analysis

```
Request flow with timing estimates (medium payload, 9-step flow):

POST /api/v1/IMCE/rate
  ├─ Parse request body                    ~2ms
  ├─ Auth (API key lookup in Redis)        ~3ms
  ├─ Fetch flow from line-rating           ~15ms (cached: ~1ms)
  ├─ Create transaction in status-service  ~20ms
  ├─ Execute pipeline:
  │   ├─ Step 1: validate_request          ~5ms
  │   ├─ Step 2: field_mapping             ~50ms (fetch mapping + fields + transform)
  │   ├─ Step 3: apply_rules              ~40ms (fetch rules + evaluate)
  │   ├─ Step 4: format_transform          ~10ms (JSON→XML)
  │   ├─ Step 5: call_rating_engine        ~200ms (external API call — dominant cost)
  │   ├─ Step 6: format_transform          ~10ms (XML→JSON)
  │   ├─ Step 7: field_mapping             ~40ms (response mapping)
  │   ├─ Step 8: apply_rules              ~30ms (post-rating rules)
  │   └─ Step 9: publish_event             ~15ms (async, non-blocking)
  ├─ Update transaction in status-service  ~25ms
  ├─ Write 9 step logs (sequential!)       ~90ms (9 × ~10ms each)
  └─ Return response                       ~2ms
                                          ─────
                                Total:    ~557ms

With caching (flow + mappings + rules cached in Redis):
  - Eliminate ~100ms of inter-service fetches
  - Total: ~450ms

With parallel step log writes:
  - Write all 9 logs in parallel instead of sequential
  - Save ~80ms
  - Total: ~370ms

With connection pooling optimized:
  - Reduce DB query latency by ~20%
  - Total: ~340ms
```

### Memory Budget per Request

| Payload Size | Peak Memory (working + response + metadata) | Safe Concurrent Requests (1 GB container) |
|---|---|---|
| 10 KB | ~200 KB | 3000+ |
| 100 KB | ~1 MB | 500+ |
| 1 MB | ~8 MB (JSON→XML doubles size) | 80 |
| 10 MB | ~80 MB | 8 |
| 50 MB | ~400 MB | 1–2 |

**For 50 MB payloads:** The container (1 GB memory) can only handle 1–2 concurrent requests. This is why:
1. Large payloads need S3 streaming (Section 1b)
2. Or dedicated "large payload" task definitions with 4–8 GB memory
3. Or the product's `maxPayloadBytes` should enforce a sane limit

### Recommended Task Definition Tiers

```hcl
# Standard tier — handles payloads up to 5 MB
resource "aws_ecs_task_definition" "core_rating_standard" {
  cpu    = 512    # 0.5 vCPU
  memory = 1024   # 1 GB
}

# Large tier — handles payloads up to 50 MB
resource "aws_ecs_task_definition" "core_rating_large" {
  cpu    = 2048   # 2 vCPU
  memory = 8192   # 8 GB
}
```

Route to the appropriate tier based on `Content-Length` header or product configuration.

---

## Implementation Priority — Complete Roadmap

### Tier 1: Foundation (Weeks 1–2)

| # | Item | Section | Effort |
|---|---|---|---|
| 1.1 | Request payload size limits | 1a | Small |
| 1.2 | Response compression (gzip) | 1c | Small |
| 1.3 | Request timeout interceptor | 1d | Small |
| 1.4 | Connection pool tuning | 1e | Small |
| 1.5 | Standardized error envelope | 7 | Medium |
| 1.6 | Enhanced health checks (liveness + readiness) | 8c | Small |

### Tier 2: Scaling & Resilience (Weeks 3–4)

| # | Item | Section | Effort |
|---|---|---|---|
| 2.1 | ECS auto-scaling policies | 2a | Medium |
| 2.2 | RDS instance upgrade (staging/prod) | 2b | Small |
| 2.3 | Redis caching layer integration | 1f | Medium |
| 2.4 | Parallel step log writes | Perf | Small |
| 2.5 | ALB timeout tuning | 2d | Small |

### Tier 3: Platform Governance (Weeks 5–8)

| # | Item | Section | Effort |
|---|---|---|---|
| 3.1 | Idempotency key support | 6 | Medium |
| 3.2 | Configuration change audit trail | 9a | Medium |
| 3.3 | Flow versioning (draft → published) | 5 | Large |
| 3.4 | API versioning strategy | 4 | Medium |
| 3.5 | Error code catalog implementation | 7b | Small |

### Tier 4: Enterprise Features (Weeks 9–12)

| # | Item | Section | Effort |
|---|---|---|---|
| 4.1 | Multi-tenancy (org isolation) | 3 | Large |
| 4.2 | OpenTelemetry distributed tracing | 8a | Medium |
| 4.3 | Prometheus metrics | 8b | Medium |
| 4.4 | Alerting rules (CloudWatch/PagerDuty) | 8d | Medium |
| 4.5 | Configuration export/import | 10 | Medium |

### Tier 5: Scale Optimization (Weeks 13+)

| # | Item | Section | Effort |
|---|---|---|---|
| 5.1 | S3 streaming for large payloads | 1b | Large |
| 5.2 | Read replicas for product-config | 2b | Medium |
| 5.3 | ElastiCache (production Redis) | 2c | Medium |
| 5.4 | Tiered task definitions (standard/large) | Perf | Medium |
| 5.5 | Data retention & archival automation | 9c | Medium |
| 5.6 | Git-based config deployment | 10c | Large |

---

## Summary: What Makes This a "Platform"

| Dimension | Current State | After This Plan |
|---|---|---|
| **API** | Internal-only, no auth | Public API with keys, rate limiting, versioning |
| **Multi-tenancy** | Single namespace | Org-isolated data and configuration |
| **Performance** | No limits, no caching | Tiered payload limits, Redis caching, compression |
| **Scaling** | Static 2 tasks | Auto-scaling 2→10 based on load |
| **Reliability** | No idempotency | Idempotency keys, circuit breakers, graceful degradation |
| **Observability** | Logs only | Traces, metrics, dashboards, alerts |
| **Governance** | No audit trail | Full audit log, flow versioning, config-as-code |
| **Error handling** | Inconsistent | Standardized error codes and envelope |
| **Large payloads** | Will crash | Tiered limits, S3 streaming, dedicated containers |
| **Compliance** | Minimal | Immutable logs, data retention, encryption |
