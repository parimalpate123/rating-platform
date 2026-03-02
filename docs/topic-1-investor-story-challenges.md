# The Integration Challenge in Insurance Modernization

> Insurance carriers are investing heavily in modernizing their core platforms — but the path from policy administration to rating execution remains a custom engineering problem every single time.

---

## 1. Every RQI Platform Brings Its Own Integration Challenge

Whether a carrier adopts Guidewire, Duck Creek, or Majesco — each platform comes with its own API contracts, data models, and formats. The rating engine on the other side (Earnix, CGI Ratabase, or homegrown) expects something completely different. The gap between policy platform and rating engine is unique every time — but the *type* of problem is always the same: translate, orchestrate, execute.

> **Example:** A carrier adopting Guidewire Cloud for commercial lines needs to connect it to their existing CGI Ratabase engine. The next carrier adopting Duck Creek OnDemand needs the exact same capability — just with different field names, different formats, different rules. Both are solving the same structural problem from scratch.

---

## 2. Integration Is the Hidden Tax on Every Modernization

The RQI platform license is the visible cost. The invisible cost? Connecting it to everything else. Every new platform adopted creates new integration projects — one per system it needs to exchange data with. These projects are expensive, time-consuming, and rarely reusable.

> **Example:** A carrier buys Earnix for pricing optimization. Before it produces a single rate, the team spends 4–6 months building custom connectors to Guidewire and to the legacy mainframe still running during transition. Multiply that by every product line Earnix needs to serve.

---

## 3. Data Format and Field-Level Mismatch Across Systems

No two platforms describe the same policy the same way. Guidewire sends JSON with `coverages[].premiumAmount`. Ratabase expects XML with `<Premium><Amount>`. Field names, nesting, data types, envelopes — all different. Every connection requires a custom translation layer built by hand.

> **Example:** A Workers' Comp product needs 140+ fields mapped between PolicyCenter and CGI Ratabase — field names don't match, some need mathematical transforms (annual premium to monthly), some need lookups (state code to region code). This mapping lives in custom code and breaks silently when either system updates its schema.

---

## 4. Carriers Have Invested Heavily in Their Own Rating Engines — SaaS Rating Isn't Always the Answer

Many RQI platforms offer built-in rating modules, but they're expensive add-ons and often can't replicate the proprietary logic carriers have built over decades. Large carriers and MGAs have invested millions into homegrown or third-party engines like CGI Ratabase and in-house actuarial models. They need a modernization path that preserves those investments — not one that forces a rip-and-replace of their rating capability.

> **Example:** A Top-25 carrier runs CGI Ratabase for 12 product lines with 20 years of actuarial models baked in. The Guidewire Cloud migration team proposes Guidewire Rating Management as the target. Actuarial pushes back — they can't revalidate and re-file 12 products worth of rates in a regulatory-compliant way. The carrier needs to keep Ratabase AND connect it to the new policy platform.

---

## 5. Actuarial and Product Teams Are Locked Out of the Process

Actuaries own the rating logic — they know the formulas, the state-specific rules, the surcharge tables. But they define this logic in spreadsheets, rate filings, and legacy systems they understand. When modernization starts, every change to rating logic — a new surcharge, a state-specific override — requires an IT deployment. The people who understand the business are dependent on the people who understand the systems.

> **Example:** An actuarial team needs to add a 15% wind/hail surcharge for coastal ZIP codes in Florida — a regulatory requirement with a filing deadline. In the legacy system, they'd update a table directly. In the new stack, it's a JIRA ticket → dev sprint → code change → QA → deploy. A 2-day business decision becomes a 6-week IT project.
