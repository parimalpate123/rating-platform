# InsuRateConnect — Facts & Challenges

---

## Facts

> Context about how insurance carriers operate — setting up the scale of the problem.

1. Insurance organizations start with one or two products and grow incrementally — each new product line triggers a new integration project
2. Actuarial and product teams are locked out of the process — IT owns the logic, business waits
3. Adopting a SaaS rating engine or platform carries significant cost and learning curve — on top of the integration work that still has to be built
4. Most carriers have invested heavily in homegrown or third-party rating engines over decades — actuarial models, state filings, and proprietary logic are baked in and cannot simply be replaced
5. RQI platforms like Guidewire, Duck Creek, and Majesco each have their own API contracts, data models, and formats — there is no common standard across them
6. Rating engines (Earnix, CGI Ratabase, homegrown) equally have their own input/output expectations — no two engines speak the same format
7. A single product line can require 140+ field mappings between a policy system and a rating engine
8. Regulatory changes — new surcharges, state-specific overrides, filing deadlines — are a constant reality, not an exception
9. Carriers often run legacy systems in parallel during modernization — the integration layer must bridge both old and new simultaneously
10. Multiple teams are involved in a single rating transaction — solution architects, business analysts, actuaries, integration engineers — but the process is currently serialized through IT
11. Time-to-market for a new product is measured in months, not weeks — integration is consistently the longest phase
12. When a premium calculation is wrong, there is no standard way to trace what happened — debugging spans multiple systems and teams

---

## Challenges

> Pure integration problems — why the integration layer itself is broken.

1. **No reusable integration layer** — every connection is built from scratch, same problem solved differently every time
2. **High development effort** — months of engineering per integration before a single rate executes
3. **Manual data translation** — hand-written field mapping per system pairing, brittle, no standard
4. **Business rules buried in code** — every rule change requires a dev cycle, not configuration
5. **Integration APIs are fragile to maintain** — schema changes on either side break mappings silently
6. **New requirements mean re-engineering** — adding a product, state, or engine reopens the integration
7. **No visibility** — when a premium is wrong, there is no trace of where it failed
