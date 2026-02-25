# Project Memory: rating-platform (InsuRateConnect)

## Project Overview
Nx monorepo — enterprise insurance rating orchestration platform.
Package manager: **npm**. Run Nx with `npx nx`.

## Implementation Status
- **Phases 1–3**: Complete (monorepo, CRUD services, UI tabs, rules engine)
- **Phase 4**: Complete as of 2026-02-21 (orchestrator wiring, transform XML, mock engines, mapping stubs)
- **Phase 5 (partial)**: Test panel added to OrchestratorTab; Transactions page already existed
- **Phases 6–8**: Not started

## Phase 4 Work Done (2026-02-21)
1. **status-service**: Fixed controller types (`Transaction`/`StepLog` re-exported from service); entities use `!` definite assignments
2. **transform-service**: Replaced placeholder xmlToJson/soapToJson with real `fast-xml-parser` (XMLParser/XMLBuilder); installed at workspace root
3. **core-rating**: Added `MockSystemsController` at `POST /api/v1/mock/earnix/rate`, `mock/ratabase/rate`, `mock/duck-creek/rate`; wired into `AppModule`
4. **core-rating**: `CallRatingEngineHandler` now fetches system config from product-config, routes to real URL or falls back to local mock endpoint
5. **line-rating**: `autoGenerate()` now calls product-config to create empty Mapping stubs for each `field_mapping` step and stores `mappingId` in step config
6. **frontend**: Added inline Test Rating panel to `OrchestratorTab` in `ProductDetail.tsx` with scope selectors, JSON editor, step trace
7. **Pre-existing TypeScript fixes**: Added `!` to all TypeORM entity properties across services, fixed `import type` in controllers, removed unused imports

## Key File Locations
- Mock systems: `orchestrators/core-rating/src/mock/mock-systems.controller.ts`
- Rating engine handler: `orchestrators/core-rating/src/handlers/call-rating-engine.handler.ts`
- Auto-generate orchestrator: `orchestrators/line-rating/src/orchestrator/orchestrator.service.ts`
- Transform service: `services/transform-service/src/transform/transform.service.ts`
- OrchestratorTab (with test panel): `frontend/rating-workspace/src/pages/ProductDetail.tsx` (line ~517)

## Pre-existing Issues (not fixed, unrelated to our changes)
- E2E spec placeholder files (`*.spec.ts` in e2e projects) fail typecheck because they use `describe`/`it`/`expect` without vitest globals — pre-existing across whole monorepo

## Architecture Notes
- All inter-service calls use HTTP over localhost ports
- `CallRatingEngineHandler` routes: system has `baseUrl` + not mock → real call; otherwise → `POST /api/v1/mock/{system}/rate` on core-rating itself
- Status-service tracks every transaction; rating-service creates/updates records automatically
- Vite proxy already set up for all services including `/api/status`, `/api/core-rating`, `/api/line-rating`
