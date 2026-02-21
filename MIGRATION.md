# Migration Plan: rating-poc → rating-platform

> This document tracks what has been migrated from the old `rating-poc/` monolith to the new `rating-platform/` Nx workspace, and what remains.

## Status Legend
- Migrated = Code copied and adapted to new structure
- Rewritten = Functionality exists but completely rewritten
- Pending = Still needs to be moved/rewritten
- Deprecated = Will not be migrated (replaced by new approach)

---

## Old → New Mapping

### Backend (apps/rating-api → services/*)

| Old Location | New Location | Status | Notes |
|---|---|---|---|
| `apps/rating-api/src/modules/product-lines/` | `services/product-config/src/product-lines/` | Rewritten | In-memory for now; will add TypeORM in Phase 2 |
| `apps/rating-api/src/modules/systems/` | `services/product-config/src/systems/` | Rewritten | Seeded with same 5 systems |
| `apps/rating-api/src/modules/mappings/` | `services/product-config/src/mappings/` | Rewritten | Includes field mappings CRUD |
| `apps/rating-api/src/modules/scopes/` | `services/product-config/src/scopes/` | Rewritten | Scope management |
| `apps/rating-api/src/modules/rules/` | `services/rules-service/src/rules/` | Rewritten | Independent service now |
| `apps/rating-api/src/modules/decision-tables/` | `services/product-config/` | Pending | Decision tables CRUD |
| `apps/rating-api/src/modules/lookup-tables/` | `services/product-config/` | Pending | Lookup tables CRUD |
| `apps/rating-api/src/modules/knowledge-base/` | — | Pending | S3/MinIO document management |
| `apps/rating-api/src/modules/scope-tags/` | `services/product-config/` | Pending | Scope tag CRUD |
| `apps/rating-api/src/modules/activity-log/` | `services/status-service/` | Pending | Activity tracking |
| `apps/rating-api/src/modules/ai-prompts/` | — | Pending | AI-assisted configuration |
| `apps/rating-api/src/modules/pipelines/` | — | Deprecated | Replaced by orchestrator concept |

### Orchestrators (NEW — no old equivalent)

| New Location | Status | Notes |
|---|---|---|
| `orchestrators/core-rating/` | Created | Step handler registry + execution engine |
| `orchestrators/line-rating/` | Created | Per-product orchestrator definitions + auto-generation |

### Frontend

| Old Location | New Location | Status | Notes |
|---|---|---|---|
| `apps/rating-workspace/` | `frontend/rating-workspace/` | Pending | Will be migrated in Phase 1 Task 14 |
| `apps/admin-ui/` | `frontend/admin-ui/` | Pending | Lower priority — workspace is primary |
| `apps/mapping-ui/` | — | Deprecated | Replaced by FieldMappingPanel in workspace |
| `apps/rules-ui/` | — | Deprecated | Replaced by RulesPanel in workspace |

### Database

| Old Location | New Location | Status | Notes |
|---|---|---|---|
| `database/init.sql` | `db/migrations/001_initial_schema.sql` | Rewritten | Clean schema with all tables |
| `database/migrations/001-006` | `db/migrations/001_initial_schema.sql` | Consolidated | All legacy migrations merged into single initial schema |
| `database/migrations/011_scopes_and_activity.sql` | `db/migrations/001_initial_schema.sql` | Merged | Included in initial schema |

### Packages

| Old Location | New Location | Status | Notes |
|---|---|---|---|
| `packages/shared/` | `packages/shared/` | Rewritten | Logger, correlation, errors, config |
| — | `packages/contracts/` | Created | NEW — TypeScript interfaces for all services |

### Infrastructure

| Old Location | New Location | Status | Notes |
|---|---|---|---|
| `docker-compose.yml` | `docker-compose.dev.yml` | Rewritten | Infra only (Postgres, Redis, MinIO) |
| `k8s/` | — | Pending | Helm charts (Phase 4+) |

---

## Retirement Steps

Once the new `rating-platform/` is fully functional:

1. **Verify feature parity** — All CRUD operations for products, systems, mappings, rules work in new services
2. **Verify data migration** — Export data from old Postgres, import into new schema
3. **Verify frontend** — Workspace UI connects to new service ports
4. **Update DNS/routing** — Point any external references to new service URLs
5. **Archive old repo** — `git tag archive-poc && git archive` or rename to `rating-poc-archived`

### What to keep from old repo:
- `ARCHITECTURE.md` — copy to new repo root
- `postman/` — update endpoint URLs and copy
- `examples/` — reference for test payloads
- `docs/` — any relevant documentation

### What to discard:
- `apps/mapping-ui/` — replaced by FieldMappingPanel
- `apps/rules-ui/` — replaced by RulesPanel
- `apps/orchestrator/` — legacy POC orchestrator
- All shell scripts (`rebuild-*.sh`, `restart-*.sh`, `start*.sh`) — replaced by Nx commands
- `test-*.sh` scripts — replaced by Nx test targets

---

## Nx Commands (New Workflow)

```bash
# Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# Run a single service
npx nx serve core-rating
npx nx serve line-rating
npx nx serve product-config

# Run all services
npx nx run-many --target=serve --all

# Build all
npx nx run-many --target=build --all

# Build only affected (after a code change)
npx nx affected --target=build

# Test
npx nx run-many --target=test --all
```
