# InsuRateConnect — Rating Platform

**A centralized rating middleware that connects any policy administration system to any rating engine — with AI-assisted configuration, business rules governance, and full transaction auditability.**

---

## Key Challenges We Are Solving

| Challenge | Impact Today |
|---|---|
| **Point-to-point integrations** | Every new product or engine requires a custom integration built from scratch — expensive, slow, and brittle |
| **IT dependency for rate changes** | Business rules and field mappings are hardcoded, forcing actuaries and product teams to wait weeks for simple rate adjustments |
| **No standard transformation layer** | Each source system sends data in a different format; engineers hand-write conversion logic for every pairing |
| **Zero visibility into rating decisions** | When a premium is wrong, there is no trace of what happened — debugging means digging through logs across multiple systems |
| **Inconsistent rule enforcement** | Business rules live in spreadsheets, email threads, and tribal knowledge — leading to errors, inconsistencies, and compliance risk |
| **Slow product launches** | Bringing a new product line to market requires months of integration work before a single rate can be tested |

---

## What It Does

InsuRateConnect sits between your policy systems (Guidewire, Duck Creek, Salesforce) and rating engines (Earnix, CGI Ratabase) — orchestrating every rating transaction through a configurable, auditable pipeline. One platform replaces dozens of point-to-point integrations.

---

## Key Features

- **AI-Assisted Field Mapping** — Describe requirements in plain English or upload a CSV; AI generates field mappings in seconds. Supports 17 transform types including date formatting, revenue scaling, lookups, and custom expressions.
- **Business Rules Engine** — Configure surcharges, discounts, eligibility rules, and field overrides through a UI — no code required. Rules are scope-aware (state, coverage, transaction type) and take effect immediately on activation.
- **Step-Based Orchestration** — Each product line defines its own pipeline: validate → map → apply rules → call rating engine → publish event. Steps are conditional and can be skipped or redirected by rules at runtime.
- **Transaction Audit Trail** — Every rating call produces a full step-by-step trace with before/after field values, timing, and outcome — supporting regulatory review and dispute resolution.
- **Event Streaming** — Completed ratings publish to Kafka, enabling downstream systems to react in real time.

---

## Value Propositions

| | |
|---|---|
| **Faster time-to-market** | Launch a new product line in hours, not months — configure in the UI, test with live data, activate when ready |
| **Business user control** | Actuaries and product managers own their rules and mappings directly, without IT bottlenecks |
| **Engine agnostic** | Add or swap rating engines without re-engineering the pipeline |
| **Full auditability** | Every rating decision is logged, traceable, and exportable |
| **AI-accelerated** | Powered by AWS Bedrock — mapping generation, rule creation, and condition expressions from natural language |

---

## Challenge → Solution → Benefit

| Challenge | Our Solution | Benefit |
|---|---|---|
| Every new product or engine integration requires custom code built from scratch | Single unified middleware layer with plug-and-play connectors for any source system or rating engine | New integrations in days, not months — reuse existing connectors across products |
| Business rules and field mappings are hardcoded, creating IT bottlenecks for every rate change | No-code UI for actuaries and product managers to create, modify, and activate rules and mappings directly | Rate changes go live in hours without a code deployment or IT ticket |
| Each source system sends data in a different structure and format | AI-powered field mapping engine with 17 transform types — auto-generates mappings from plain English requirements or CSV uploads | Eliminate hand-written conversion code; mappings are versioned, auditable, and reusable |
| No visibility into why a premium was calculated a certain way | Full step-by-step transaction trace — every field value, rule fired, and transform applied is logged per rating call | Faster debugging, regulatory compliance, and confident dispute resolution |
| Business rules scattered across spreadsheets, emails, and tribal knowledge | Centralized rules engine with scope-aware governance — rules target specific states, coverages, and transaction types | Consistent rule enforcement across all products, reduced errors and compliance risk |
| Switching or adding a rating engine requires re-engineering the pipeline | Engine-agnostic orchestration — rating engine is just one configurable step in the flow | Vendor flexibility and negotiating leverage; test multiple engines side by side |
| Downstream systems have no real-time awareness of completed ratings | Kafka event publishing on every rating completion — `rating.completed` and `rating.failed` topics | Instant downstream reactions — billing, CRM, reporting, and data warehouse updates without polling |

---

## Current State

Fully operational end-to-end for General Liability — field mapping, rules evaluation, Earnix rating, and event publishing running in production-ready microservices on AWS EKS. Tested live: **GL quote rated at $2,933 premium in ~110ms.**
