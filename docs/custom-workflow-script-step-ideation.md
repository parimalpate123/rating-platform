# Custom Workflow: Script / Code Step — Ideation & Feasibility

**Goal:** Let users add a step that runs **user-defined code** to transform the incoming request (working context) and/or the response for that step, so workflows are not locked to built-in step types and can implement arbitrary logic.

**Status:** Brainstorm and ideation. No implementation yet.

---

## 1. Current State

- **Orchestrator:** Main flow and **custom flows** are sequences of steps. Each step has a `stepType` (e.g. `field_mapping`, `apply_rules`, `call_rating_engine`, `run_custom_flow`) and a `config`.
- **Custom flow:** A named sub-flow (list of steps) invoked via the `run_custom_flow` step. Today it only allows step types: `validate_request`, `generate_value`, `field_mapping`, `enrich`, `publish_event`. It does **not** run user-written code; it runs the same built-in handlers.
- **Execution context:** Every handler receives the same `ExecutionContext`: `request`, `working`, `enrichments`, `response`, plus `correlationId`, `productLineCode`, `scope`, `metadata`. Handlers **mutate** `context.working` and/or `context.response` in place. The next step sees the updated context.
- **Precedent for user code:** Step **condition expressions** already run user-provided JavaScript in a sandbox via Node `vm.runInNewContext` (timeout 100ms, only `request` and `working` in scope). So the platform already executes user-supplied code in a controlled way.

So: “Custom workflow” today = reusable sequence of **built-in** steps. The ask is to add a step type that runs **user code** to transform request/response, making workflows truly extensible.

---

## 2. Is It Scalable?

| Aspect | Assessment |
|--------|------------|
| **Execution model** | Run user script **in-process** in the same Node process as the orchestrator (same as condition expressions). No new service or worker pool. Throughput scales with existing core-rating instances. |
| **Latency** | In-process execution avoids network hop; typical script runtime should be milliseconds. Timeout (e.g. 5–30s) caps worst case. |
| **Multi-tenancy** | Scripts are per-step config (or per script asset per product). No shared mutable state between requests. |
| **Heavy logic** | If users write CPU-heavy or long-running code, they hit the step timeout and need to offload to an external API (e.g. `call_external_api` step) instead. For typical request/response shaping, in-process is sufficient. |

**Verdict:** Scalable for a real product, provided we enforce timeout and (optionally) memory limits and keep scripts focused on transforming data, not replacing the rating engine.

---

## 3. Is It Possible?

Yes, with a clear contract and the same runtime we already use for conditions.

- **New step type** (e.g. `run_script` or `transform_script`).
- **Handler** in core-rating:
  - Reads script source from step config (inline) or from a stored “script” asset (e.g. product-config or line-rating) referenced by ID.
  - Runs the script in a **sandbox** (Node `vm` or `isolated-vm`) with a controlled context: e.g. `request`, `working`, `response`, `scope`, and optionally `enrichments`.
  - Script can **mutate** `working` and/or `response` (and optionally `enrichments`) to match the existing handler contract. No need to pass context by reference if we copy in and merge out; we can also pass a facade that only exposes allowed keys and mutates the real context.
  - Enforce **timeout** (e.g. 5–30s) and optional **memory** limit; on error or timeout, return step `failed` and do not mutate context.
- **Storage:** Either inline script in step `config.scriptSource`, or store scripts as versioned entities (e.g. in product-config or line-rating) and reference by `scriptId` (+ optional `version`) in step config. Latter improves reuse, versioning, and audit.

**Verdict:** Technically straightforward; the main decisions are sandboxing strictness, timeout, and where scripts are stored (inline vs script library).

---

## 4. Is It a Good Approach? (Product & Architecture)

**Pros**

- **Flexibility:** Users are not locked into predefined step types. They can implement one-off or product-specific logic (normalization, derived fields, response shaping) without waiting for a new handler type.
- **Alignment with “process”:** Using the same language as the orchestrator (JavaScript/TypeScript) keeps the stack consistent and avoids new runtimes (e.g. Python/Deno) for v1, which simplifies ops and security.
- **Consistency with existing pattern:** Same execution model (context in, mutate working/response) as other handlers; only the “logic” is user-provided.
- **Custom flows become more powerful:** Custom flows can include this step type (e.g. add `run_script` to `ALLOWED_CUSTOM_FLOW_STEP_TYPES`), so “custom workflow” literally includes user code.

**Risks and mitigations**

| Risk | Mitigation |
|------|-------------|
| **Security** (escape from sandbox, access to env/fs/network) | Use a strict sandbox (e.g. `vm` with minimal context, or `isolated-vm`). Expose only `request`, `working`, `response`, `scope`, and perhaps a small allowlisted utility (e.g. JSON parse). No `require`, no `process`, no `global`. |
| **Infinite loop / CPU burn** | Mandatory timeout (e.g. 5s default, configurable up to 30s). |
| **Large payload / memory** | Optional memory cap; document that scripts should not hold huge objects. Rely on timeout as a backstop. |
| **Audit / compliance** | Store script source and version; log script identifier and version in step result and transaction history so “what ran” is traceable. |
| **Bad code breaking the flow** | On exception or timeout, mark step as failed and (with `onFailure: stop`) halt pipeline; do not apply partial mutations. Same as other steps. |

**Verdict:** Good approach for a real product, provided we ship with strict sandboxing, timeout, clear API contract, and versioning/audit from day one.

---

## 5. Design Choices to Decide

### 5.1 Step type name

- **`run_script`** — Emphasizes execution of a script.
- **`transform_script`** — Emphasizes request/response transformation.
- **`code`** — Short and generic.

**Recommendation:** `run_script` or `transform_script`; avoid `code` to prevent confusion with “code” as in product/line code.

### 5.2 Script storage

- **A — Inline only:** Script source in step `config.scriptSource`. Simple, no new entities. Harder to reuse and version.
- **B — Script library only:** Scripts stored as first-class entities (e.g. in product-config or line-rating) with name, product line, version; step references `scriptId` (+ optional version). Reuse and audit are clear.
- **C — Both:** Inline for quick one-off; optional reference to a stored script for reuse and versioning.

**Recommendation:** Start with **A (inline)** for v1 to ship faster; design the step config and handler so we can add **B** later (e.g. `config.scriptId` + `config.scriptSource` as fallback).

### 5.3 Script API (what the user code sees)

- **Sync function:** User exports a function `(request, working, response, scope) => void` (or returns `{ working?, response? }`). Handler calls it and merges returned values into context. Simple; no async in sandbox.
- **Async function:** Same signature but `async`; handler awaits. Allows `Promise` but complicates sandbox (vm can run async with some care).

**Recommendation:** Start with **sync** and a clear contract: “function receives (request, working, response, scope) and may mutate working and response in place.” Add async later if needed.

### 5.4 Language and runtime

- **JavaScript only (Node vm):** Same runtime as orchestrator; no new dependencies. Aligns “code language with the process.”
- **TypeScript:** Could be compiled to JS before execution (build-time or on save in UI). Adds tooling; not required for v1.
- **Other languages (Python, etc.):** Would require out-of-process execution (subprocess or separate service), more ops and security surface. Not recommended for v1.

**Recommendation:** **JavaScript** in the step config / script body; document that the runtime is the same as the orchestrator. Optionally allow a small, allowlisted “prelude” (e.g. `JSON.parse`) in the sandbox.

### 5.5 Where the step is available

- **Main orchestrator only:** Simpler; custom flows stay as they are.
- **Main + custom flows:** Add the new step type to the main flow and to `ALLOWED_CUSTOM_FLOW_STEP_TYPES` so custom workflows can include script steps.

**Recommendation:** **Main + custom flows** so “custom workflow” fully includes the ability to add code.

### 5.6 Sandbox and security

- **Node `vm`:** Already used for condition expressions. Not perfect (theoretical escape vectors); acceptable for trusted internal users and with a strict context (no require, no process).
- **isolated-vm:** Stronger isolation; adds native dependency and slightly more complexity. Consider for a future hardening phase if you need to run less-trusted code.

**Recommendation:** Start with **Node `vm`** and a minimal context (only `request`, `working`, `response`, `scope`). Document that script step is for trusted operators; consider `isolated-vm` or a separate script-runner service if governance requirements increase.

---

## 6. Test Script Step (Run Before Save)

Allowing users to **test** the script step with sample input before saving or running a full flow is part of the feature from day one. It is not overkill—it improves safety, iteration speed, and clarity of the script contract.

### 6.1 Why include testing

- **Safety:** Run the script against sample payloads before promoting to production.
- **Faster iteration:** No need to trigger a full flow or call a real rating engine to verify behavior.
- **Clarity:** Users see “request in → working/response out” for concrete examples, making the contract obvious.
- **Consistency:** Aligns with testing other configurable logic (e.g. mapping previews, rule simulators).

### 6.2 Behavior

1. **Where:** In the step editor for `run_script`, a **Test** section (e.g. collapsible panel below the script editor).
2. **Sample input:** User provides sample JSON for `request` and optionally `working` and `response` (defaults: `working` = copy of `request`, `response` = `{}`). Optional `scope` (e.g. `{ state: 'NY' }`).
3. **Run test:** Button calls a dedicated **test endpoint** that runs the same script in the same sandbox as production (same timeout, same contract). No flow execution, no DB writes.
4. **Result:** Show updated `working` and/or `response` (e.g. side-by-side or before/after / diff). On error or timeout, show the error message and do not apply any changes.

### 6.3 API

- **Endpoint:** e.g. `POST /api/v1/script/run` (core-rating or orchestrator). Body: `{ scriptSource, request, working?, response?, scope?, timeoutMs? }`. Response: `{ working, response, error?, durationMs? }`.
- **Implementation:** Reuse the same script-execution helper used by the step handler (single place for sandbox + timeout). The test endpoint is a thin wrapper: validate input, run script, return result. No need to duplicate sandbox logic.

### 6.4 UI scope (v1)

- One test endpoint and one “Test” block in the script-step config UI is sufficient.
- Optional later: “Use last run context” to prefill sample input from the last flow run (if available).

---

## 7. AI Code Generation

Allowing users to **generate** the script from a natural-language description (e.g. “If building age > 30 and state is CA, set working.surcharge = 0.15”) fits the same pattern as existing AI features (rule generation, mapping suggestions) and reduces the barrier to using the script step.

### 7.1 Feasibility

- **Existing capability:** The platform already uses AWS Bedrock (Claude) for rule generation (rules-service) and mapping suggestions (product-config). Same model and IAM can be reused for “plain English → script body.”
- **Contract is clear:** The script API is fixed: `(request, working, response, scope)` with in-place mutation. The LLM prompt can include this contract, example snippets, and “output only the function body, no require/process/explanation.”
- **Quality:** Generated code may need editing or a quick Test run. Treat AI as a starting point; user can edit and test before saving. Optional: “Regenerate” or “Fix this error” (send current script + error message back to LLM).

### 7.2 Behavior

1. **Where:** In the step editor for `run_script`, a **Generate with AI** action (e.g. button or collapsible panel above/beside the script editor). User enters a short description of what the script should do.
2. **Request:** Frontend calls an endpoint (e.g. `POST /api/v1/script/generate`) with body `{ prompt, productLineCode?, contextSample? }`. Optional `contextSample` is a minimal request/working shape so the model can tailor field names.
3. **Backend:** Service (core-rating or rules-service) builds a system prompt that includes: script contract, “mutate working and/or response in place,” “output only JavaScript function body, no markdown,” and optionally 1–2 example snippets. User prompt is appended. Call Bedrock (Claude); strip markdown code fences from the response; return `{ scriptSource, confidence? }`.
4. **UI:** Insert or replace `scriptSource` in the editor. Optionally run Test with a sample payload to validate. User can edit and save as usual.

### 7.3 Where to implement

- **Option A — core-rating:** Add Bedrock dependency and a `POST /script/generate` (or under a shared “script” module). Keeps script-related APIs in one place; core-rating may need IAM/Bedrock if not already present.
- **Option B — rules-service:** Reuse existing Bedrock integration; add endpoint `POST /script/generate`. Slight mismatch (rules vs script) but no new service; frontend would call rules-service for generate and core-rating for run/test.
- **Option C — product-config:** Same as B but product-config already has Bedrock for mappings; could host script generate there. Slightly more consistent (“config” includes script generation).

**Recommendation:** **Option B (rules-service)** for v1: no new Bedrock wiring, rules-service already has “generate from natural language” patterns. If we later consolidate all “run script” APIs in core-rating, we can move generate there or have core-rating proxy to rules-service.

### 7.4 Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Hallucination / wrong code** | User must review and test. Generated code is a draft; Test panel validates before save. Optional “Run test after generate” in UI. |
| **Security (LLM output in sandbox)** | Generated script is executed in the same sandbox as hand-written script; no extra privileges. Sanitize output (strip non-JS, no `require`/`process` in prompt). |
| **Prompt injection** | System prompt is fixed; user input is clearly separated. Do not pass untrusted data as part of the system prompt. |
| **Cost / rate limits** | Same as rule generation: Bedrock usage and optional rate limit per tenant/user. |

### 7.5 Scope (v1)

- One generate endpoint; one “Generate with AI” control in the script-step editor; insert or replace script body. No mandatory “regenerate on error” or multi-turn in v1; can add later.

---

## 8. Proposed High-Level Behavior

1. **New step type:** e.g. `run_script`.
2. **Step config (v1):**
   - `scriptSource`: string (required) — JavaScript function body. Handler wraps it so it receives `(request, working, response, scope)` and can mutate `working` and `response`.
   - Optional: `timeoutMs` (default e.g. 5000, max 30000).
3. **Handler (core-rating):**
   - Build a sandbox context: `{ request, working, response, scope }` (copies or facades).
   - Compile and run the user function in `vm.runInNewContext` with timeout.
   - If success: merge sandbox `working` and `response` back into `context.working` and `context.response`.
   - If error or timeout: return step failed; do not mutate context.
4. **UI:** In the step config form for `run_script`, show: **Generate with AI** (prompt input, “Generate” button, insert/replace script); code editor for `scriptSource`; optional timeout; **Test** section (sample JSON, “Run test”, result panel). Later: dropdown to pick a stored script by name/id.
5. **Test endpoint:** `POST /api/v1/script/run` (or equivalent) to run script with sample payload; reuse same execution helper as the step handler. See §6.
6. **AI generate endpoint:** e.g. `POST /api/v1/script/generate` (rules-service or core-rating) with `{ prompt, productLineCode?, contextSample? }`; returns `{ scriptSource }`. See §7.
7. **Custom flows:** Add `run_script` to `ALLOWED_CUSTOM_FLOW_STEP_TYPES` so custom flows can contain script steps.
8. **Docs:** Document the script contract (signature, allowed mutations, timeout, no I/O), security assumptions, and that the language aligns with the orchestrator (JavaScript). Document Test panel and Generate with AI.

---

## 9. Summary

| Question | Answer |
|----------|--------|
| **Scalable?** | Yes — in-process execution, same as existing steps; timeout and optional memory cap protect the process. |
| **Possible?** | Yes — new step type + handler using Node vm (or isolated-vm), same pattern as condition expressions. |
| **Good approach?** | Yes — high flexibility, aligns language with process, fits existing context/response model. Mitigate security and audit with sandbox, timeout, and versioning. |
| **POC vs product?** | Design for product: sandbox, timeout, clear contract, versioning/audit from the start; start with inline script and JS only, extend to script library and optional async later. |
| **Test script step?** | Yes — include a Test panel in the step editor and a dedicated run endpoint; reuse the same execution logic as the handler. See §6. |
| **AI code generation?** | Yes — “Generate with AI” in the step editor; endpoint takes prompt and returns script body; reuse Bedrock (e.g. rules-service). User reviews and tests before save. See §7. |

Next steps after ideation: (1) Document the script contract and security model in ARCHITECTURE or a dedicated doc. (2) Follow the phase-wise implementation plan (script step → test → AI generate). (3) Add `run_script` to custom flow allowed types and test end-to-end.
