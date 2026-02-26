# InsuRateConnect — Rating Platform
### Leadership Overview

---

## Slide 1 — The Problem We Solve

> **Every time we add a product, state, or rating engine — it requires months of custom integration work.**

| Pain Point | Impact |
|---|---|
| Policy systems (Guidewire, Duck Creek) speak a different language than rating engines (Earnix, CGI Ratabase) | Manual field mapping per integration |
| Business rules buried in code | IT bottleneck for every rate change |
| No visibility into what happened during a rating transaction | Impossible to debug or audit |
| Adding a new product line requires full dev cycle | Slow time-to-market |

---

## Slide 2 — What Is InsuRateConnect?

**A centralized rating middleware platform** that sits between your policy administration systems and rating engines — orchestrating, transforming, and governing every rating transaction.

```
Policy System          InsuRateConnect              Rating Engine
──────────────    ───────────────────────────    ──────────────────
Guidewire    ──►  Validate → Map → Rules   ──►  Earnix
Duck Creek   ──►  Transform → Rate → Audit ──►  CGI Ratabase
Salesforce   ──►  Publish → Track          ──►  Duck Creek Rating
```

**One platform. Any source. Any engine.**

---

## Slide 3 — Core Capabilities

### Orchestration Engine
- Step-based workflow per product line (validate → map → rules → rate → publish)
- Configurable flow per transaction type (new business, renewal, endorsement)
- Conditional step execution — rules can skip or redirect steps at runtime

### AI-Assisted Field Mapping
- Paste requirements text or upload CSV → AI generates field mappings instantly
- 17 transform types: direct copy, divide, multiply, date format, expression, lookup, concatenate, and more
- Mirror mappings (request ↔ response) auto-generated
- Human review + override before activation

### Business Rules Engine
- 14 condition operators (equals, between, regex, contains, in, is_null, and more)
- 9 action types (set, surcharge, discount, reject, flag, skip step, copy field, append)
- Scope filtering — rules fire only for matching state / coverage / transaction type
- Rules dry-run: test without submitting a real transaction

### Transaction Intelligence
- Full step-by-step execution trace for every rating call
- Before/after field values tracked at each step
- Searchable transaction history

---

## Slide 4 — Value Propositions

| Value | Description |
|---|---|
| **10× faster integration** | AI generates field mappings from plain-English requirements in seconds vs weeks of manual mapping |
| **Business user empowerment** | Non-technical teams create and activate rules without writing code |
| **Full auditability** | Every rating transaction is logged with complete step traces — supports regulatory and dispute review |
| **Engine agnostic** | Switch or add a rating engine (Earnix → CGI → Duck Creek) without re-engineering the pipeline |
| **Real-time event streaming** | Kafka publish on every completed rating — downstream systems react instantly |
| **Scope-aware governance** | Rules and mappings can be targeted to specific states, coverages, or transaction types |

---

## Slide 5 — Platform Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React UI (Port 4200)                │
│  Products · Orchestrator · Mappings · Rules · Test  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              core-rating  (Port 4000)               │
│         Step Execution Engine · Mock Engines        │
└──┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
line-rating  rules-   transform-  status-
(4001)      service   service     service
Flows &     (4012)    (4011)      (4013)
Products    Business  JSON/XML    Transactions
            Rules     Transform   & Audit
                        │
                 product-config
                    (4010)
                 Mappings · Scopes
                 Systems · Tables
```

**Infrastructure:** PostgreSQL · Redis · Kafka (events) · AWS Bedrock (AI) · AWS EKS (production)

---

## Slide 6 — Supported Integrations

| Category | Systems |
|---|---|
| **Policy Administration** | Guidewire PolicyCenter, Duck Creek, Salesforce |
| **Rating Engines** | Earnix, CGI Ratabase, Duck Creek Rating, Custom |
| **AI** | AWS Bedrock (Claude) — mapping generation, rule generation, condition expressions |
| **Events** | Apache Kafka — `rating.completed`, `rating.failed` topics |
| **Cloud** | AWS EKS, ECR — containerized microservices |

---

## Slide 7 — What We've Built (Current State)

| Capability | Status |
|---|---|
| Product line & system configuration | **Live** |
| Step-based orchestration engine | **Live** |
| AI field mapping (17 transform types) | **Live** |
| Business rules engine (14 operators, 9 actions) | **Live** |
| Scope-based filtering (state / coverage / transaction) | **Live** |
| Transaction history & step traces | **Live** |
| Kafka event publishing | **Live (mock)** |
| External rating engine connectors | **Live (mock — Earnix tested end-to-end)** |
| D&B data enrichment | Planned |
| Decision / lookup tables | Planned |
| Real-time monitoring dashboard | Planned |

---

## Slide 8 — End-to-End Demo Flow (GL Product)

A General Liability quote from Guidewire PolicyCenter runs through the full pipeline in **~110ms**:

```
1. Validate Request      →  8 fields validated
2. Map Request Fields    →  10/10 fields transformed
                            (dates formatted, revenue ÷ 1M, territory mapped)
3. Pre-Rating Rules      →  Business rules evaluated & applied
4. Call Earnix           →  Premium: $2,933 · Fees: $88 · Total: $3,021
5. Map Response Fields   →  Earnix response normalized back
6. Post-Rating Rules     →  Post-rate adjustments applied
7. Publish Event         →  rating.completed → Kafka
```

**Result:** Full audit trail · Mapped fields in working context · Premium returned to caller

---

## Slide 9 — Strategic Value

> **InsuRateConnect turns months of integration work into hours of configuration.**

- **For Product Teams** — Launch a new product line without waiting for IT. Configure mappings and rules in the UI, test with live data, activate when ready.
- **For Actuaries** — Own your business rules directly. Adjust surcharges, discounts, and eligibility criteria without a code deployment.
- **For IT / Engineering** — One integration per system, not one per product. Add a new product line in the UI, not in code.
- **For Compliance & Finance** — Every rating decision is logged, traceable, and exportable for audit.

---

*Built on: NestJS · React · TypeScript · PostgreSQL · AWS · Apache Kafka*
*Architecture: Microservices · Event-driven · API-first*
