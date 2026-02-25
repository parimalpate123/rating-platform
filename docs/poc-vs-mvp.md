# InsuRateConnect — Prototype vs MVP Assessment

## Definitions

### Prototype (Current State)

A **prototype** demonstrates that the core concept works. It proves the architecture, validates the approach, and shows stakeholders what the platform *could* do. It is not production-safe.

**Characteristics of the current prototype:**
- All 7 services scaffolded and communicating
- UI functional for configuration (products, mappings, rules, orchestrators, scopes)
- Orchestration engine executes steps in sequence with resilience patterns
- AI-assisted rule and mapping generation (Bedrock + heuristic fallback)
- Mock rating engines for local/demo testing
- Deployed to AWS (ECS Fargate + RDS + ALB) — but with dev-tier resources
- No authentication, no payload limits, no caching, no auto-scaling, no audit trail

**Good for:** Demos, stakeholder buy-in, architecture validation, internal experimentation

---

### MVP (Minimum Viable Product)

An **MVP** is the smallest version of the platform that can be used by a real external consumer (e.g., a partner system, an internal line of business) in production with acceptable risk. It doesn't need every feature — but it must not lose data, crash under normal load, or expose one consumer's data to another.

**Characteristics of an MVP:**
- A real product line can be configured end-to-end and produce correct results
- External systems can call the API securely
- Errors are clear and actionable
- The system doesn't crash or lose data under expected load
- Operators can diagnose and fix issues without reading source code
- Configuration changes are tracked and reversible

**Good for:** First production pilot (1–3 product lines), early adopter onboarding, production validation

---

## Functionality Comparison: Prototype vs MVP

| # | Functionality | Prototype (Today) | MVP (Target) |
|---|---|---|---|
| | **Product Configuration** | | |
| 1 | Create / edit / delete product lines | ✅ Full CRUD via UI + API | ✅ No Gap |
| 2 | Register external systems (Earnix, CGI, etc.) | ✅ 5 systems seeded + CRUD | ✅ No Gap |
| 3 | Define scopes (state, coverage, txn type) | ✅ Full CRUD via UI + API | ✅ No Gap |
| 4 | Per-product settings (payload limit, timeout) | ❌ No product-level config | ✅ Max payload size, timeout, rate limit per product |
| 5 | Product activation (draft → active enforcement) | 🔶 Status field exists but not enforced | ✅ Only active products/mappings/rules used at runtime |
| | **Orchestration** | | |
| 6 | Visual flow builder (drag/drop steps) | ✅ 9-step pipeline visualized | ✅ No Gap |
| 7 | Multiple flows per product (/rate, /init-rate) | ✅ Tab-based flow selector | ✅ No Gap |
| 8 | 10 step handler types | ✅ All 10 registered and functional | ✅ No Gap |
| 9 | Step conditions (simple + JS expressions) | ✅ VM-sandboxed evaluation | ✅ No Gap |
| 10 | Retry with exponential backoff | ✅ Configurable per step | ✅ No Gap |
| 11 | Circuit breaker per step | ✅ In-memory state tracking | ✅ No Gap |
| 12 | Failure modes (stop / skip / use_default) | ✅ Per-step configuration | ✅ No Gap |
| 13 | Nested orchestration (custom flows) | ✅ RunCustomFlowHandler | ✅ No Gap |
| 14 | Working data visible in API response | ❌ Only `context.response` returned | ✅ `data` field with final `context.working` state |
| 15 | Flow versioning (draft → published → rollback) | ❌ Edits are live immediately | 🔶 Nice-to-have — not blocking MVP |
| | **Field Mapping** | | |
| 16 | Mapping CRUD (UI + API) | ✅ Full CRUD with inline editing | ✅ No Gap |
| 17 | 17 transformation types defined in schema | ✅ All types in dropdown + config fields | ✅ No Gap |
| 18 | AI-powered field suggestion (Bedrock) | ✅ Text → field suggestions with confidence | ✅ No Gap |
| 19 | CSV / text import | ✅ Upload → parse → preview → create | ✅ No Gap |
| 20 | Mirror mapping (auto-create reverse) | ✅ Swap source↔target + reverse transforms | ✅ No Gap |
| 21 | Atomic create-with-fields | ✅ Single API call creates mapping + all fields | ✅ No Gap |
| 22 | Direct field copy at runtime | ✅ Handler copies source → target via dot-path | ✅ No Gap |
| 23 | Default value fallback at runtime | ✅ Uses `defaultValue` when source missing | ✅ No Gap |
| 24 | **Transform execution at runtime** (multiply, divide, round, date, expression) | ❌ All transform configs ignored — only copies | ✅ Transform executor applies configured transformations |
| 25 | Required field validation at runtime | ❌ `isRequired` flag ignored | ✅ Missing required fields logged as warnings |
| 26 | Scope-filtered mapping selection | ❌ First matching mapping used | 🔶 Nice-to-have — not blocking MVP |
| 27 | Mapping test / preview | ❌ No way to test before activating | 🔶 Nice-to-have |
| | **Rules Engine** | | |
| 28 | Rule CRUD (UI + API) | ✅ Full CRUD with conditions + actions | ✅ No Gap |
| 29 | 14 condition operators | ✅ ==, !=, >, <, contains, in, is_null, etc. | ✅ No Gap |
| 30 | 9 action types | ✅ set, add, subtract, multiply, divide, surcharge, discount, reject, set_premium | ✅ No Gap |
| 31 | Scope filtering on rules | ✅ AND between types, OR within type | ✅ No Gap |
| 32 | Priority-based evaluation | ✅ Higher priority evaluated first | ✅ No Gap |
| 33 | AI rule generation (Bedrock + heuristic) | ✅ Plain-English → structured rule | ✅ No Gap |
| 34 | Condition expression generation | ✅ Description → JS expression | ✅ No Gap |
| 35 | `between` operator | ❌ Not implemented | ✅ "Age between 25 and 65" — basic insurance use case |
| 36 | Division-by-zero protection | ❌ Divide action can crash | ✅ Guard with warning log, skip action |
| 37 | Type validation on arithmetic actions | ❌ Non-numeric values produce NaN silently | ✅ Validate operands, skip with warning |
| 38 | `regex` operator | ❌ Not implemented | 🔶 Nice-to-have |
| 39 | `flag` / `skip_step` actions | ❌ Not implemented | 🔶 Nice-to-have |
| 40 | Rule dry-run / test endpoint | ❌ No way to test without executing | 🔶 Nice-to-have |
| | **Format Transformation** | | |
| 41 | JSON ↔ XML conversion | ✅ Via fast-xml-parser | ✅ No Gap |
| 42 | JSON ↔ SOAP envelope wrapping | ✅ Namespace + action support | ✅ No Gap |
| | **Rating Engine Integration** | | |
| 43 | Mock engines (Earnix, CGI, Duck Creek, GW) | ✅ 4 mock endpoints with realistic responses | ✅ No Gap |
| 44 | Real engine calls (JSON + XML) | ✅ Configurable per system | ✅ No Gap |
| 45 | System config lookup from product-config | ✅ Dynamic URL + format resolution | ✅ No Gap |
| 46 | Premium extraction from engine response | ✅ Extracted and stored in transaction | ✅ No Gap |
| | **Transaction & Monitoring** | | |
| 47 | Transaction creation + status update | ✅ PROCESSING → COMPLETED/FAILED | ✅ No Gap |
| 48 | Per-step execution logs | ✅ stepId, status, duration, output, error | ✅ No Gap |
| 49 | Transactions page in UI | ✅ List + detail view | ✅ No Gap |
| 50 | Working data stored in transaction | ❌ Only `responsePayload` saved | ✅ `workingData` captured for audit trail |
| 51 | Step logs written in parallel | ❌ Sequential (adds ~80ms) | ✅ Parallel writes for performance |
| | **Public API** | | |
| 52 | Internal endpoint (`POST /rate/:code`) | ✅ Works for internal/UI calls | ✅ No Gap (kept for backward compat) |
| 53 | Product-first endpoint (`POST /:code/rate`) | ❌ Not implemented | ✅ External system contract |
| 54 | Named flow endpoint (`POST /:code/rate/:flow`) | ❌ Not implemented | ✅ Route to specific flows (quote, renew) |
| 55 | API key authentication | ❌ Zero authentication | ✅ X-API-Key header, scoped to products |
| 56 | Rate limiting | ❌ No throttling | ✅ Per-key sliding window via Redis |
| 57 | Idempotency keys | ❌ Duplicate requests create duplicates | 🔶 Nice-to-have |
| 58 | OpenAPI / Swagger docs | ❌ No API documentation | 🔶 Nice-to-have |
| 59 | Webhook notifications (async) | ❌ Not implemented | ❌ Post-MVP |
| 60 | Batch rating API | ❌ Not implemented | ❌ Post-MVP |
| | **Frontend (UI)** | | |
| 61 | Product management (CRUD + tabbed layout) | ✅ Full product configuration UI | ✅ No Gap |
| 62 | Orchestrator flow builder + visual pipeline | ✅ Step cards with flow visualization | ✅ No Gap |
| 63 | Mappings tab (CRUD + AI + CSV + mirror) | ✅ Full field management with metadata | ✅ No Gap |
| 64 | Rules tab (CRUD + AI generation + scope tags) | ✅ Rule editor with preview panel | ✅ No Gap |
| 65 | Scopes tab | ✅ Scope management UI | ✅ No Gap |
| 66 | Dark mode + global search | ✅ Theme toggle + search bar | ✅ No Gap |
| 67 | Transactions monitoring page | ✅ List + detail view | ✅ No Gap |
| 68 | API key management page | ❌ Not implemented | ✅ Create/revoke keys, view usage |
| 69 | Mapping test / preview panel | ❌ Not implemented | 🔶 Nice-to-have |
| 70 | Rule test panel | ❌ Not implemented | 🔶 Nice-to-have |
| 71 | Dashboard with metrics | ❌ Not implemented | 🔶 Nice-to-have |
| | **Infrastructure & Operations** | | |
| 72 | ECS Fargate deployment | ✅ 10 services on Fargate | ✅ No Gap |
| 73 | RDS PostgreSQL 16 with backups | ✅ db.t3.micro, 7-day backups | ✅ Upgrade to db.t3.medium+ for prod |
| 74 | ALB with path-based routing (7 rules) | ✅ Priority-based routing to all services | ✅ No Gap |
| 75 | Service discovery (Cloud Map DNS) | ✅ Multivalue routing, 10s TTL | ✅ No Gap |
| 76 | TLS / HTTPS | ✅ TLS 1.2+ with ACM cert | ✅ No Gap |
| 77 | Docker + ECR (per-service images) | ✅ 10 ECR repos, CI builds | ✅ No Gap |
| 78 | Auto-scaling | ❌ Static 2 tasks per service | ✅ Target-tracking on core-rating + rules-service |
| 79 | Redis caching | ❌ Redis running but not integrated | ✅ Cache flows, mappings, rules (2–5 min TTL) |
| 80 | Connection pool tuning | ❌ TypeORM defaults (max 10) | ✅ Configured per service (max 20–30) |
| 81 | Request payload size limits | ❌ Unlimited — will OOM on large payloads | ✅ Per-service Express body-parser limits |
| 82 | Request timeout interceptor | ❌ No NestJS-level timeout | ✅ 55s default (under ALB 60s idle) |
| 83 | Response compression (gzip) | ❌ All responses uncompressed | ✅ gzip for responses > 1 KB |
| 84 | Monitoring / alerting | ❌ CloudWatch logs only | ✅ Basic alarms: error rate, latency, CPU |
| 85 | Distributed tracing (OpenTelemetry) | ❌ Not implemented | 🔶 Nice-to-have |
| 86 | Multi-tenancy (org isolation) | ❌ Not implemented | ❌ Post-MVP |
| 87 | Config export / import | ❌ Not implemented | ❌ Post-MVP |
| 88 | Data retention / archival | ❌ Not implemented | 🔶 Nice-to-have |
| | **Security & Compliance** | | |
| 89 | Encryption at rest (RDS AES-256) | ✅ Enabled | ✅ No Gap |
| 90 | TLS in transit | ✅ ALB → ECS, ECS → RDS | ✅ No Gap |
| 91 | VPC isolation (RDS private) | ✅ ECS-only security group | ✅ No Gap |
| 92 | Secrets management | 🔶 Env vars + AWS Secrets Manager support | ✅ No Gap |
| 93 | VM sandbox for expressions | ✅ node:vm with 100ms timeout | ✅ No Gap |
| 94 | API authentication | ❌ Zero auth on all endpoints | ✅ API key auth on public endpoints |
| 95 | Configuration audit trail | ❌ No audit log | ✅ Who changed what, when — immutable log |
| 96 | Standardized error codes | ❌ Inconsistent error format | ✅ Error code catalog + consistent envelope |
| | **Totals** | **✅ 56 Done &nbsp;&nbsp; 🔶 4 Partial &nbsp;&nbsp; ❌ 36 Missing** | **20 items to close for MVP** |

### Summary by Section

| Section | Prototype Status | MVP Gaps (specific items) |
|---|---|---|
| **Product Configuration** | 3 of 5 done | Per-product settings (max payload, timeout, rate limit); Enforce active-only at runtime |
| **Orchestration** | 8 of 10 done | `data` field missing in API response (working state invisible to caller) |
| **Field Mapping** | 8 of 12 done | Transform execution not implemented (multiply, divide, round, date, expression configs all ignored at runtime); `isRequired` flag not enforced |
| **Rules Engine** | 7 of 13 done | `between` operator not implemented (common insurance use case); Division-by-zero crashes on divide action; Non-numeric values produce NaN silently on arithmetic actions |
| **Format Transformation** | 2 of 2 done | No gaps — fully functional |
| **Rating Engine Integration** | 4 of 4 done | No gaps — mock + real engines working |
| **Transaction & Monitoring** | 3 of 5 done | `workingData` not stored in transaction (audit trail incomplete); Step logs written sequentially adding ~80ms latency |
| **Public API** | 1 of 9 done | Product-first endpoint (`/:code/rate`) not built; Zero authentication on any endpoint; No rate limiting; No named flow routing (`/:code/rate/:flow`) |
| **Frontend (UI)** | 7 of 11 done | No API key management page (needed once auth is implemented) |
| **Infrastructure & Operations** | 6 of 17 done | No auto-scaling (static 2 tasks); Redis not integrated for caching; TypeORM connection pool at defaults (max 10); No payload size limits (will OOM on large bodies); No request timeout interceptor; No response compression; No monitoring/alerting beyond logs |
| **Security & Compliance** | 5 of 8 done | No API authentication at all; No configuration audit trail (who changed what); Inconsistent error format (no error code catalog) |

---

## Assessment Table (Detailed — by Category)

### Legend

| Symbol | Meaning |
|---|---|
| ✅ Done | Exists and functional in prototype |
| 🔶 Partial | Started but incomplete or has significant gaps |
| ❌ Missing | Not implemented |
| **Bold** | Required for MVP |

---

### Core Platform

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Service architecture (7 microservices)** | ✅ Done | ✅ Sufficient | — |
| **Inter-service communication (HTTP + correlation IDs)** | ✅ Done | ✅ Sufficient | — |
| **Global prefix + CORS** | ✅ Done | ✅ Sufficient | — |
| **Health check endpoints** | ✅ Done | 🔶 Needs enhancement | Add dependency checks, liveness/readiness split |
| **Database (PostgreSQL 16 + migrations)** | ✅ Done | ✅ Sufficient | Upgrade instance class for prod |
| **Deployment pipeline (ECR + ECS + Terraform)** | ✅ Done | ✅ Sufficient | — |
| Error handling | 🔶 Inconsistent | **Standardized error codes + envelope** | ❌ No error taxonomy |
| Request payload limits | ❌ Missing | **Per-service body size limits** | ❌ Unlimited today — will crash on large payloads |
| Request timeouts | ❌ Missing | **Global timeout interceptor** | ❌ No NestJS-level timeout |
| Response compression | ❌ Missing | **gzip middleware** | ❌ Uncompressed responses |

### Product Configuration

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Product line CRUD** | ✅ Done | ✅ Sufficient | — |
| **System registration (Earnix, CGI, etc.)** | ✅ Done | ✅ Sufficient | — |
| **Product scopes (state, coverage, txn type)** | ✅ Done | ✅ Sufficient | — |
| Product activation workflow | 🔶 Status field exists (draft/active) | **Enforce active-only in runtime** | Handlers accept draft mappings/rules today |
| Product-level settings (max payload, timeout) | ❌ Missing | **Per-product config overrides** | ❌ No per-product limits |

### Orchestration Engine

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Step-based execution loop** | ✅ Done | ✅ Sufficient | — |
| **10 step handler types** | ✅ Done | ✅ Sufficient | — |
| **Step condition evaluation (simple + expression)** | ✅ Done | ✅ Sufficient | — |
| **Retry with exponential backoff** | ✅ Done | ✅ Sufficient | — |
| **Circuit breaker (in-memory)** | ✅ Done | ✅ Sufficient | — |
| **Failure modes (stop/skip/use_default)** | ✅ Done | ✅ Sufficient | — |
| **Custom flows (nested orchestration)** | ✅ Done | ✅ Sufficient | — |
| Working data in API response | ❌ Missing | **`data` field in response** | ❌ Only `response` returned (from engine) |
| Flow versioning | ❌ Missing | 🔶 Nice-to-have for MVP | No rollback if flow edit breaks production |

### Field Mapping

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Mapping CRUD (UI + API)** | ✅ Done | ✅ Sufficient | — |
| **Field mapping CRUD (17 transform types defined)** | ✅ Done | ✅ Sufficient | — |
| **AI-powered field suggestion (Bedrock)** | ✅ Done | ✅ Sufficient | — |
| **CSV/text import** | ✅ Done | ✅ Sufficient | — |
| **Mirror mapping creation** | ✅ Done | ✅ Sufficient | — |
| **Atomic create-with-fields** | ✅ Done | ✅ Sufficient | — |
| Direct field copy (in handler) | ✅ Done | ✅ Sufficient | — |
| Default value fallback (in handler) | ✅ Done | ✅ Sufficient | — |
| Transformation execution (multiply, date, expression, etc.) | ❌ Missing | **At least: multiply, divide, round, date, expression** | ❌ Handler only copies — ignores all transform configs |
| Required field validation | ❌ Missing | **Validate `isRequired` fields** | ❌ `isRequired` flag ignored |
| Scope filtering for mappings | ❌ Missing | 🔶 Nice-to-have | Mappings not filtered by state/coverage scope |
| Mapping test/preview | ❌ Missing | 🔶 Nice-to-have | No way to test a mapping before activating |

### Rules Engine

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Rule CRUD (UI + API)** | ✅ Done | ✅ Sufficient | — |
| **14 condition operators** | ✅ Done | ✅ Sufficient | — |
| **9 action types (set, add, multiply, surcharge, reject, etc.)** | ✅ Done | ✅ Sufficient | — |
| **Scope filtering (AND/OR logic)** | ✅ Done | ✅ Sufficient | — |
| **AI rule generation (Bedrock + heuristic)** | ✅ Done | ✅ Sufficient | — |
| **Condition expression generation** | ✅ Done | ✅ Sufficient | — |
| **Priority-based evaluation** | ✅ Done | ✅ Sufficient | — |
| `between` operator | ❌ Missing | **Yes — common in insurance** | "Age between 25 and 65" is a basic use case |
| `regex` operator | ❌ Missing | 🔶 Nice-to-have | — |
| `flag` action | ❌ Missing | 🔶 Nice-to-have | — |
| `skip_step` action | ❌ Missing | 🔶 Nice-to-have | — |
| Division-by-zero guard | ❌ Missing | **Yes — will crash in prod** | ❌ No validation on arithmetic actions |
| Type validation on arithmetic | ❌ Missing | **Yes — non-numeric values cause NaN** | ❌ No type checking |
| Rule dry-run / testing | ❌ Missing | 🔶 Nice-to-have | — |

### Format Transformation

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **JSON ↔ XML conversion** | ✅ Done | ✅ Sufficient | — |
| **JSON ↔ SOAP conversion** | ✅ Done | ✅ Sufficient | — |
| **Configurable root tags + namespaces** | ✅ Done | ✅ Sufficient | — |

### Rating Engine Integration

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Mock engines (Earnix, CGI, Duck Creek, GW)** | ✅ Done | ✅ Sufficient for testing | — |
| **Real engine calls (JSON + XML)** | ✅ Done | ✅ Sufficient | — |
| **System config from product-config** | ✅ Done | ✅ Sufficient | — |
| **Premium extraction from response** | ✅ Done | ✅ Sufficient | — |

### Transaction & Status Tracking

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Transaction creation + update** | ✅ Done | ✅ Sufficient | — |
| **Per-step execution logs** | ✅ Done | ✅ Sufficient | — |
| **UI: Transactions page** | ✅ Done | ✅ Sufficient | — |
| Working data stored in transaction | ❌ Missing | **Audit trail of transformed state** | ❌ Only `responsePayload` stored |
| Step logs written in parallel | ❌ Missing | **Yes — sequential writes add ~80ms** | 🔶 Performance issue, not correctness |

### Public API

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| Internal endpoint (`POST /rate/:productCode`) | ✅ Done | ✅ Sufficient | — |
| Product-first endpoint (`POST /:productCode/rate`) | ❌ Missing | **Yes — external system contract** | ❌ Not implemented |
| API key authentication | ❌ Missing | **Yes — cannot expose unauthenticated** | ❌ No auth at all |
| Rate limiting | ❌ Missing | **Basic per-key throttle** | ❌ No limits |
| Idempotency keys | ❌ Missing | 🔶 Nice-to-have | — |
| OpenAPI / Swagger docs | ❌ Missing | 🔶 Nice-to-have | — |
| Webhook notifications | ❌ Missing | ❌ Not for MVP | — |
| Batch rating API | ❌ Missing | ❌ Not for MVP | — |

### Frontend (UI)

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Product management (CRUD + tabs)** | ✅ Done | ✅ Sufficient | — |
| **Orchestrator flow builder + visual pipeline** | ✅ Done | ✅ Sufficient | — |
| **Mappings tab (CRUD + AI + CSV)** | ✅ Done | ✅ Sufficient | — |
| **Rules tab (CRUD + AI generation)** | ✅ Done | ✅ Sufficient | — |
| **Scopes tab** | ✅ Done | ✅ Sufficient | — |
| **Dark mode + search** | ✅ Done | ✅ Sufficient | — |
| **Transactions monitoring page** | ✅ Done | ✅ Sufficient | — |
| Mapping test/preview panel | ❌ Missing | 🔶 Nice-to-have | — |
| Rule test panel | ❌ Missing | 🔶 Nice-to-have | — |
| API key management page | ❌ Missing | **Yes — needed for API key auth** | — |
| Dashboard with metrics | ❌ Missing | 🔶 Nice-to-have | — |

### Infrastructure & Operations

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **ECS Fargate deployment** | ✅ Done | ✅ Sufficient | — |
| **RDS PostgreSQL with backups** | ✅ Done | 🔶 Upgrade instance class | db.t3.micro is dev-only |
| **ALB with path-based routing** | ✅ Done | ✅ Sufficient | — |
| **Service discovery (Cloud Map)** | ✅ Done | ✅ Sufficient | — |
| **TLS/HTTPS** | ✅ Done | ✅ Sufficient | — |
| **Docker + ECR** | ✅ Done | ✅ Sufficient | — |
| Auto-scaling | ❌ Missing | **At least core-rating + rules-service** | ❌ Static 2 tasks |
| Redis caching | ❌ Missing (running but unused) | **Cache flow definitions + mappings** | ❌ Every request hits DB |
| Connection pool tuning | ❌ Missing | **Configure pool sizes** | ❌ TypeORM defaults (max 10) |
| Monitoring / alerting | ❌ Missing | **Basic CloudWatch alarms** | ❌ Logs only |
| Distributed tracing | ❌ Missing | 🔶 Nice-to-have | — |
| Multi-tenancy | ❌ Missing | ❌ Not for MVP | — |
| Configuration export/import | ❌ Missing | ❌ Not for MVP | — |
| Data retention policy | ❌ Missing | 🔶 Nice-to-have | — |

### Security & Compliance

| Capability | Prototype | MVP Required | Gap |
|---|---|---|---|
| **Encryption at rest (RDS)** | ✅ Done | ✅ Sufficient | — |
| **TLS in transit** | ✅ Done | ✅ Sufficient | — |
| **VPC isolation (RDS not public)** | ✅ Done | ✅ Sufficient | — |
| API authentication | ❌ Missing | **API key auth on public endpoints** | ❌ Zero auth |
| Configuration audit trail | ❌ Missing | **Who changed what, when** | ❌ No audit log |
| Secrets management | 🔶 Env vars + AWS Secrets Manager support | ✅ Sufficient | — |
| Input sanitization / injection prevention | 🔶 Basic (TypeORM parameterized queries) | ✅ Sufficient | VM sandbox for expressions |

---

## MVP Scorecard Summary

| Category | Done (Prototype) | MVP Gaps | Priority |
|---|---|---|---|
| Core Platform | 5/10 | Payload limits, timeouts, compression, error codes, health checks | P0 |
| Orchestration | 7/8 | Working data in response | P0 |
| Field Mapping | 8/12 | Transform execution, required validation, defensive guards | P0 |
| Rules Engine | 8/12 | `between` operator, arithmetic guards | P0 |
| Public API | 1/8 | Product-first endpoint, API key auth, rate limiting | P0 |
| Infrastructure | 7/12 | Auto-scaling, caching, connection pools, monitoring | P1 |
| Security | 4/7 | API auth, audit trail | P0 |
| Frontend | 7/10 | API key management page | P1 |
| **Total** | **47/79** | **32 gaps** | |

---

## What Must Be Done for MVP

The following is the minimum set of changes to go from prototype to MVP — scoped to what a first production pilot (1–3 product lines, controlled external consumers) needs:

| # | Item | Effort | Docs Reference |
|---|---|---|---|
| 1 | Expose `working` as `data` in API response | Small | `live-orchestration-api-plan.md` Phase 1–2 |
| 2 | Product-first public endpoint (`/:productCode/rate`) | Small | `live-orchestration-api-plan.md` Phase 3 |
| 3 | API key authentication | Medium | `live-orchestration-api-plan.md` Phase 4 |
| 4 | Basic rate limiting | Small | `live-orchestration-api-plan.md` Phase 5 |
| 5 | Field transformation execution (multiply, divide, round, date, expression) | Medium | `mapping-and-rules-enhancement-plan.md` Phase 1 |
| 6 | Required field validation in handler | Small | `mapping-and-rules-enhancement-plan.md` Phase 1c |
| 7 | `between` operator in rules | Small | `mapping-and-rules-enhancement-plan.md` Phase 2a |
| 8 | Arithmetic guards (÷0, type validation) | Small | `mapping-and-rules-enhancement-plan.md` Phase 2g |
| 9 | Request payload size limits | Small | `platform-readiness-plan.md` Section 1a |
| 10 | Request timeout interceptor | Small | `platform-readiness-plan.md` Section 1d |
| 11 | Response compression (gzip) | Small | `platform-readiness-plan.md` Section 1c |
| 12 | Standardized error codes + envelope | Medium | `platform-readiness-plan.md` Section 7 |
| 13 | Connection pool tuning | Small | `platform-readiness-plan.md` Section 1e |
| 14 | ECS auto-scaling (core-rating + rules-service) | Medium | `platform-readiness-plan.md` Section 2a |
| 15 | Redis caching for flow/mapping/rule lookups | Medium | `platform-readiness-plan.md` Section 1f |
| 16 | RDS instance upgrade (staging/prod) | Small | `platform-readiness-plan.md` Section 2b |
| 17 | Basic CloudWatch alarms (error rate, latency, CPU) | Small | `platform-readiness-plan.md` Section 8d |
| 18 | Enhanced health checks (dependency status) | Small | `platform-readiness-plan.md` Section 8c |
| 19 | Configuration audit trail | Medium | `platform-readiness-plan.md` Section 9a |
| 20 | API key management UI page | Medium | — |

**Estimated total effort:** 6–8 weeks for a single developer, or 3–4 weeks with two developers working in parallel (infra track + feature track).
