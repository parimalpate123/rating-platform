# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

---

## Commands

**Package manager:** npm (no prefix needed for most Nx commands; use `npx nx` if `nx` is not on PATH)

### Build & Type-check
```bash
npx nx build <project>           # Build a single project
npx nx run-many -t build         # Build all projects
npx nx typecheck <project>       # Type-check a single project
npx nx run-many -t typecheck     # Type-check all projects
```

### Test
```bash
npx nx test <project>            # Run unit tests for a project (Vitest)
npx nx run-many -t test          # Run all unit tests
npx nx e2e <project>-e2e        # Run Playwright e2e tests for a project
```

### Lint & Format
```bash
npx nx run-many -t lint          # Lint all projects
npx nx format:check              # Check formatting (Prettier)
npx nx format:write              # Auto-fix formatting
```

### Serve (development)
```bash
npx nx serve <project>           # Serve a single project in watch mode
npx nx serve rating-workspace    # Start the React frontend (port 4200)
```

### Full CI check (matches GitHub Actions)
```bash
npx nx run-many -t lint test build typecheck e2e-ci
```

### Local development workflow
```bash
# 1. Start infrastructure (Postgres :5433, Redis :6380, MinIO :9010)
./scripts/start-infra.sh
# or: docker compose -f docker-compose.dev.yml up -d

# 2. Run database migrations
./scripts/run-migrations.sh
# Works with or without psql installed — falls back to docker exec on the container

# 3. Build all backend services
npx nx run-many -t build

# 4. Start all backend services (runs built dist/main.js files; logs → logs/<name>.log)
./scripts/start-all.sh

# 5. Start the frontend
./scripts/start-ui.sh
# or: npx nx serve rating-workspace

# Stop all services
./scripts/stop-all.sh
```

### Deploy to AWS
```bash
./scripts/deploy.sh [IMAGE_TAG]   # Full deploy: migrations → build → ECR push → Terraform apply
# Env vars: ECR_REGISTRY, RUN_MIGRATIONS=1, SKIP_BUILD, SKIP_TERRAFORM, IMAGE_TAG
```

---

## Architecture

### Monorepo Layout

```
orchestrators/   - Core execution engines (NestJS + Webpack)
services/        - Domain microservices (NestJS + Webpack)
packages/        - Shared libraries (contracts, shared utilities)
frontend/        - React UI (Vite + TailwindCSS v4)
db/              - SQL migrations and seed files
infra/           - Terraform for AWS (ECR + EKS)
scripts/         - Local dev and deployment scripts
```

All workspaces are declared in root `package.json` under `"workspaces"`.

### Services & Ports

| Project | Port | Role |
|---|---|---|
| `core-rating` (orchestrator) | 4000 | Receives rating requests; executes step-based workflows |
| `line-rating` (orchestrator) | 4001 | Manages per-product orchestrator definitions |
| `product-config` (service) | 4010 | CRUD for product lines, systems, mappings, scopes |
| `transform-service` (service) | 4011 | JSON/XML field transformation and mapping execution |
| `rules-service` (service) | 4012 | Business rule evaluation (14 operators, 9 action types, scope filtering) |
| `status-service` (service) | 4013 | Transaction history and per-step execution traces |
| `rating-workspace` (frontend) | 4200 | React SPA — product management, mappings, rules, scopes |

All backend services expose `GET /api/v1/health` for health checks.

### Shared Packages

- `packages/contracts` — TypeScript interfaces for inter-service communication
- `packages/shared` — Logging, correlation IDs, error handling, configuration utilities

### Core Execution Model

Rating requests enter `core-rating`, which executes an ordered list of **steps** defined per product. Each step type has a **handler**:

- `FieldMappingHandler` → calls `transform-service`
- `ApplyRulesHandler` → calls `rules-service`
- `FormatTransformHandler` → calls `transform-service` (JSON ↔ XML)
- `CallRatingEngineHandler` → calls external engines (Earnix, CGI Ratabase, etc.)
- `PublishEventHandler` → publishes to Kafka (Phase 6)
- `CallOrchestratorHandler` → nested orchestrator calls

**Scope filtering** is applied throughout — rules and mappings can be filtered by state, coverage type, and transaction type.

### Frontend Proxy

The Vite dev server proxies API calls so the frontend talks to backend services without CORS issues:

- `/api/line-rating` → `http://localhost:4001/api/v1`
- `/api/core-rating` → `http://localhost:4000/api/v1`
- Similar paths for all other services

### Database

**PostgreSQL 16** (local dev: host `localhost`, port `5433`, db `rating_platform`, user `rating_user`, password `rating_pass`)

Key tables: `product_lines`, `product_systems`, `mappings`, `mapping_fields`, `rules`, `rule_conditions`, `rule_actions`, `product_scopes`, `orchestrators`, `orchestrator_steps`, `transactions`, `transaction_step_logs`, `systems`, `ai_prompts`.

Migrations live in `db/migrations/` and are idempotent. Seed data in `db/seeds/` pre-populates 5 external systems (Guidewire, CGI, Earnix, Duck Creek, Salesforce).

### Infrastructure

Terraform in `infra/terraform/` provisions AWS ECR repositories (one per service/frontend), an EKS cluster, Kubernetes deployments/services, and an ingress. Secrets and configuration are injected via ConfigMaps/Secrets.

### Testing

- **Unit tests:** Vitest — `src/**/*.spec.ts` / `*.test.ts` in each project
- **E2E tests:** Playwright — `<project>-e2e/src/` directories, run against live services
- CI target is `e2e-ci` (not `e2e`)

### Tech Stack Summary

| Layer | Technology |
|---|---|
| Backend framework | NestJS 11 |
| ORM | TypeORM 0.3 |
| Frontend | React 19 + Vite 7 + TailwindCSS 4 |
| Build (backend) | Webpack + SWC |
| Unit testing | Vitest 4 |
| E2E testing | Playwright |
| TypeScript | 5.9 (strict, ES2022 target) |
| AI integration | AWS Bedrock (rules-service) |

### Implementation Status (as of last session)

- **Complete (Phases 1–3):** All services scaffolded, product-config CRUD, rules evaluation, mappings, scopes, frontend with product management UI, dark mode theme
- **In progress (Phase 4):** Orchestrator end-to-end wiring, transform-service real impl, status-service transaction recording
- **Planned (Phases 5–8):** Kafka events, D&B enrichment, external system connectors, decision/lookup tables, monitoring dashboard
