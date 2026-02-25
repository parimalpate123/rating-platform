# Script Step (run_script)

The **Run script** step lets you execute inline JavaScript during orchestration to **transform the incoming request payload** (e.g. from Guidewire PolicyCenter) and/or the working/response. It is available in the main orchestrator and in custom flows.

**Use this step for:** request payload transformation — renaming or moving fields, normalizing dates/codes, flattening or nesting structures, or deriving values from the request so downstream steps (mapping, rules, rating engine) get the shape they expect.

**Do not use for:** field-by-field mapping (use the **Field Mapping** step) or rating logic like surcharges/discounts (use the **Rules** step).

## Contract

- **Signature:** Your code runs as the body of a function that receives four arguments: `(request, working, response, scope)`.
- **Mutation:** You may mutate `working` and `response` **in place**. Those mutations are visible to the next step and become the final response when the pipeline completes.
- **No I/O:** The script runs in a sandbox. It cannot use `require`, `process`, `global`, or network. Only the four objects above are available.
- **Timeout:** Default 5000 ms, configurable per step (100–30000 ms). On timeout or error, the step fails and context is not mutated.

## Example (Guidewire request payload transformation)

Typical use: normalize or reshape an incoming Guidewire (or other source) request before mapping and rating.

```javascript
// Normalize Guidewire Policy effective date to ISO and copy policy number into working
working.policy = working.policy || {};
working.policy.effectiveDate = request?.Policy?.EffectiveDate
  ? new Date(request.Policy.EffectiveDate).toISOString().slice(0, 10)
  : undefined;
working.policy.policyNumber = request?.Policy?.PolicyNumber;

// Copy first location building number from GW request for downstream steps
const loc = request?.Locations?.[0] || request?.Policy?.Locations?.[0];
working.locationId = loc?.BuildingNumber ?? loc?.LocationNumber;
```

## Security

Scripts run in Node’s `vm` with a minimal context. They are intended for trusted operators. Do not pass untrusted input into script content.

## Runtime

The same JavaScript runtime as the orchestrator (Node.js). Language aligns with the process.

## Generate with AI

In the step editor you can use **Generate with AI**: describe the **request payload transformation** in plain English (e.g. “Normalize Guidewire Policy.EffectiveDate to ISO in working.policy.effectiveDate” or “Copy Locations[0].BuildingNumber to working.locationId”). The generated code is a starting point — always review and test before saving.

## Test

Use the **Test** section in the step editor to run the current script against sample request JSON without executing the full flow. You see updated `working` and `response` or an error and duration.
