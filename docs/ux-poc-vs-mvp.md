# InsuRatePro — User Experience: Prototype vs MVP

## Definitions

### Prototype UX (Current State)

The UI is **feature-complete for configuration** — a user can create products, build orchestrator flows, define mappings and rules, and run test ratings. However, the experience assumes a technical user who understands the system internals, can tolerate silent failures, and doesn't need guardrails.

### MVP UX (Target)

The UI should be usable by a **product configuration specialist** (not a developer) who needs to set up a new product line, validate it works, and hand off API credentials to an integration partner — with confidence that errors are visible, inputs are validated, and actions are reversible.

---

## User Experience Comparison: Prototype vs MVP

| # | User Experience Area | Prototype (Today) | MVP (Target) |
|---|---|---|---|
| | **Onboarding & First Use** | | |
| 1 | Getting Started guide | ✅ 8-step guide with links to each page | Improve: Track completion progress per step (checkmarks) |
| 2 | First product creation | ✅ Modal with name, systems, description | Improve: Wizard with sample data + auto-create default flow |
| 3 | Sample / demo product pre-loaded | ❌ Empty platform on first login | ✅ Seed a demo product (e.g., "Sample BOP") with flow, mappings, rules so user sees a working example |
| 4 | Contextual help / tooltips | ❌ No tooltips on any form fields | ✅ Tooltip icons on complex fields (transformationType, conditionExpression, scope tags) |
| 5 | Empty state guidance | ✅ All pages have empty states with CTA buttons | ✅ No Gap |
| | **Navigation & Search** | | |
| 6 | Sidebar navigation | ✅ Icon strip + text panel, product tree, section grouping | ✅ No Gap |
| 7 | Global search (Cmd+K) | ✅ Fuzzy search across pages + products | Improve: Also search rules, mappings, and flows by name |
| 8 | Breadcrumb / back navigation | 🔶 Back arrow on Custom Flow edit only | ✅ Breadcrumbs on all nested pages (Product → Orchestrator → Step) |
| 9 | Tab memory (return to last tab) | ❌ Always resets to Overview tab on product load | ✅ Remember last active tab per product |
| 10 | Keyboard shortcuts | ✅ Cmd+K for search | ✅ No Gap |
| | **Product Configuration** | | |
| 11 | Product CRUD | ✅ Create, edit name/status/description/systems | ✅ No Gap |
| 12 | Product status enforcement | 🔶 Status field exists (draft/active) but runtime ignores it | ✅ Visual warning when editing active product: "Changes affect production" |
| 13 | Product settings (limits, timeouts) | ❌ No per-product settings | ✅ Settings section: max payload size, timeout, rate limit |
| 14 | Product overview tab | ✅ Shows product details + activity feed | ✅ No Gap |
| | **Orchestrator Flow Builder** | | |
| 15 | Visual pipeline diagram | ✅ Horizontal step cards with type badges and service labels | ✅ No Gap |
| 16 | Multiple flows per product (/rate, /init-rate) | ✅ Tab selector with "+ Add Flow" | ✅ No Gap |
| 17 | Add / edit / delete steps | ✅ Full CRUD with config forms per step type | ✅ No Gap |
| 18 | Drag-to-reorder steps | ✅ Drag handle reorders step execution order | ✅ No Gap |
| 19 | Step condition configuration | ✅ Simple conditions + JS expression editor | ✅ No Gap |
| 20 | Step resilience config (retry, circuit breaker) | ✅ Configurable per step | ✅ No Gap |
| 21 | Flow status (draft/active) | ✅ Badge shown on flow | Improve: "Publish" button with confirmation before going live |
| 22 | Flow validation before publish | ❌ No validation — can publish empty or broken flow | ✅ Warn if: 0 active steps, missing handler configs, unreachable services |
| 23 | Step click → inspect detail | ✅ Click node shows detail panel | ✅ No Gap |
| | **Mappings Configuration** | | |
| 24 | Mapping list with accordion expand | ✅ Collapsible cards with field count, direction badge | ✅ No Gap |
| 25 | Add / edit / delete fields | ✅ Inline row editing with all 17 transform types | ✅ No Gap |
| 26 | AI-powered field suggestion | ✅ Text → suggestions with confidence scores | ✅ No Gap |
| 27 | CSV / text import | ✅ Upload → parse → preview → create | ✅ No Gap |
| 28 | Mirror mapping creation | ✅ Auto-create reverse mapping with swapped paths | ✅ No Gap |
| 29 | Mapping preview modal (AI results) | ✅ Select/deselect suggestions, filter by confidence | ✅ No Gap |
| 30 | Field path validation | ❌ No validation that source/target paths exist | ✅ Warn if path doesn't match sample payload structure |
| 31 | Transformation config feedback | ❌ User sets multiply factor but has no idea if it works | ✅ Show preview: "Input: 50000 → Output: 57500 (× 1.15)" inline |
| 32 | Mapping test / dry-run | ❌ No way to test mapping before activating | ✅ "Test Mapping" button: paste sample JSON, see transformed output |
| 33 | Mapping status (draft/active) indicator | 🔶 Status exists but not visually prominent | ✅ Clear badge + "Activate" button when ready |
| | **Rules Configuration** | | |
| 34 | Rule list with expand/collapse | ✅ Cards showing name, priority, condition count | ✅ No Gap |
| 35 | Rule editor modal | ✅ Name, description, priority, conditions, actions | ✅ No Gap |
| 36 | AI rule generation | ✅ Plain-English → structured rule with sample prompts | ✅ No Gap |
| 37 | Scope tag management | ✅ Add/remove state, coverage, txn type tags on saved rules | Improve: Allow scope tags during initial rule creation (not just edit) |
| 38 | Rule preview (IF/THEN display) | ✅ Shows condition → action logic in readable format | ✅ No Gap |
| 39 | Condition field autocomplete | ❌ Free-text field input with no suggestions | ✅ Dropdown suggestions from sample payload fields or past rules |
| 40 | Rule test / dry-run | ❌ No way to test rule against sample data | ✅ "Test Rule" button: paste JSON context, see which conditions pass/fail and actions applied |
| 41 | Rule conflict detection | ❌ No warning if two rules contradict each other | 🔶 Nice-to-have: Warn if rules with same scope have conflicting actions on same field |
| 42 | Action value validation | ❌ Accepts any text for numeric actions (multiply, divide) | ✅ Validate: numeric fields accept numbers only, show error inline |
| | **Scopes** | | |
| 43 | Scope dimension management (3 columns) | ✅ State, Coverage, Transaction Type with add/remove | ✅ No Gap |
| 44 | Scope value validation | ❌ Accepts any freeform text | ✅ State: validate 2-letter codes; Transaction type: dropdown only |
| 45 | Bulk import of scope values | ❌ Add one at a time only | 🔶 Nice-to-have: Paste comma-separated list |
| | **Systems Registry** | | |
| 46 | System CRUD | ✅ Add/edit/delete with auth config | ✅ No Gap |
| 47 | Health check per system | ✅ Click "Check" → shows healthy/unhealthy + latency | ✅ No Gap |
| 48 | Platform service health | ✅ Grid of all internal services with status | ✅ No Gap |
| 49 | Auth credential testing | ❌ Save credentials without verifying they work | ✅ "Test Connection" button before saving |
| | **Decision / Lookup Tables** | | |
| 50 | Table CRUD | ✅ Create table, add key→value entries | ✅ No Gap |
| 51 | Entry editing | ❌ Cannot edit existing entries (must delete + re-add) | ✅ Inline edit for entry key and value |
| 52 | Bulk import (CSV) | ❌ Add entries one at a time only | ✅ Upload CSV with key,value columns |
| 53 | Entry uniqueness validation | ❌ Duplicate keys silently accepted | ✅ Warn on duplicate key within same table |
| | **Knowledge Base** | | |
| 54 | Document upload + status tracking | ✅ Upload with progress bar, status badges | ✅ No Gap |
| 55 | "Coming soon" badge accuracy | 🔶 Badge says "Coming soon" but upload is fully functional | ✅ Remove misleading badge — feature works |
| 56 | Document search / filter | ❌ No way to search uploaded documents | 🔶 Nice-to-have: Filter by name, type, status |
| | **AI Prompts** | | |
| 57 | View and edit prompt templates | ✅ Collapsible cards with monospace editor | ✅ No Gap |
| 58 | Variable placeholder visibility | ✅ Blue/cyan badges showing `{{variables}}` | ✅ No Gap |
| 59 | Prompt testing / preview | ❌ Edit template with no way to test output | 🔶 Nice-to-have: "Test Prompt" with sample variables → see AI output |
| 60 | Create new prompt templates | ❌ Can only edit existing prompts | 🔶 Nice-to-have |
| | **Custom Flows** | | |
| 61 | Flow CRUD (create, edit, delete) | ✅ Full lifecycle with scope (universal/product) | ✅ No Gap |
| 62 | Step management (add, edit, reorder) | ✅ Type-specific config forms, drag reorder | ✅ No Gap |
| 63 | Step type explanation | ❌ No description of what each step type does | ✅ Help text or tooltip per step type in dropdown |
| | **Test Rating** | | |
| 64 | Product + flow selector | ✅ Dropdown with available flows | ✅ No Gap |
| 65 | JSON payload editor | ✅ Dark monospace textarea with "Format" button | ✅ No Gap |
| 66 | Scope input fields | ✅ State, coverage, transaction type inputs | ✅ No Gap |
| 67 | Execution result visualization | ✅ Step-by-step flow diagram with click-to-inspect | ✅ No Gap |
| 68 | Premium display | ✅ Large green box showing extracted premium | ✅ No Gap |
| 69 | Working data visibility in result | ❌ Only shows `response` — transformed `working` state not visible | ✅ Show `data` (working state) alongside `response` in result panel |
| 70 | Save / load test payloads | ❌ Must re-type or paste payload every time | ✅ Save named payloads per product; load from dropdown |
| 71 | Sample payload per product | ❌ Generic placeholder for all products | ✅ Auto-generate sample from mapping source fields |
| 72 | Diff view (before/after per step) | ❌ Raw JSON only, no visual comparison | 🔶 Nice-to-have: Highlight what changed in working state after each step |
| | **Transactions & Insights** | | |
| 73 | Transaction list with filters | ✅ Product, status filters; expandable rows | ✅ No Gap |
| 74 | Execution flow visualization | ✅ Horizontal step diagram with status icons | ✅ No Gap |
| 75 | Step detail panel (input/output JSON) | ✅ Slide-out panel with collapsible sections | ✅ No Gap |
| 76 | Insights advanced search (8 filters) | ✅ Policy #, account #, correlation ID, dates, product, status | ✅ No Gap |
| 77 | Success rate metric | ✅ Shows overall success rate + completed/failed counts | ✅ No Gap |
| 78 | Top errors display | ✅ Lists most frequent errors with count | ✅ No Gap |
| 79 | Date range filtering | ✅ From/To date pickers on Insights page | ✅ No Gap |
| 80 | Sorting on transaction list | ❌ No sort by date, duration, or status | ✅ Column header click-to-sort |
| 81 | Transaction export | ❌ No way to export/download results | 🔶 Nice-to-have: Export filtered results as CSV |
| | **API Key Management** | | |
| 82 | API key management page | ❌ Page does not exist | ✅ Create, list, revoke API keys with product scope |
| 83 | Key usage dashboard | ❌ No usage tracking visible | ✅ Show request count, last used, rate limit per key |
| 84 | Copy key to clipboard | ❌ Not applicable (no keys) | ✅ One-click copy; key shown only once on creation |
| | **Error Handling & Feedback** | | |
| 85 | API failure notification | ❌ Silent failures — empty state shown if service is down | ✅ Red error banner: "Could not reach [service]. Check if it's running." |
| 86 | Form validation (before submit) | ❌ Most forms accept anything, errors only on save | ✅ Inline validation: required fields, numeric ranges, JSON syntax |
| 87 | Save confirmation feedback | 🔶 Some forms show spinner, some silently succeed | ✅ Consistent toast notification: "Saved successfully" / "Save failed: reason" |
| 88 | Destructive action confirmation | 🔶 Delete shows "Confirm" text link but no modal | ✅ Confirmation modal for all deletes: "Delete rule 'NY Surcharge'? This cannot be undone." |
| 89 | Retry on failure | ❌ Errors have no retry option — user must refresh page | ✅ "Retry" button on error states |
| 90 | Error message clarity | 🔶 Mix of generic ("Failed to load") and technical ("AxiosError: ECONNREFUSED") | ✅ User-friendly messages: "Rules service is not responding. Try again or check service status." |
| | **Visual Design & Responsiveness** | | |
| 91 | Dark mode | ✅ Toggle in top bar, persists in localStorage, all pages styled | ✅ No Gap |
| 92 | Consistent color system | ✅ Status badges, step types, confidence scores all color-coded | ✅ No Gap |
| 93 | Icon consistency (Lucide) | ✅ All icons from lucide-react library | ✅ No Gap |
| 94 | Mobile / tablet support | ❌ Fixed-width sidebar + 3-column grids — no responsive breakpoints | 🔶 Nice-to-have: Collapsible sidebar, responsive grids |
| 95 | Skeleton loading states | ❌ Spinners only — no skeleton placeholders | ✅ Skeleton loaders for cards, tables, and panels (perceived faster) |
| 96 | Consistent button styles | ✅ Primary (blue), secondary (gray), special (purple), danger (red) | ✅ No Gap |
| | **Accessibility** | | |
| 97 | Keyboard navigation | ✅ Cmd+K search, Enter/Escape in modals | ✅ No Gap |
| 98 | ARIA labels on interactive elements | ❌ No aria-label on icon-only buttons | ✅ All icon buttons and expandable rows have aria-labels |
| 99 | Focus trapping in modals | ❌ Tab key escapes modals | ✅ Focus trapped inside open modals |
| 100 | Color contrast (WCAG AA) | 🔶 Most text passes, light gray subtitle text may fail | ✅ All text meets WCAG AA 4.5:1 contrast ratio |
| | **Totals** | **✅ 56 No Gap &nbsp; 🔶 10 Partial &nbsp; ❌ 34 Missing** | **24 items to close for MVP** |

---

### Summary by Section

| Section | Prototype Status | MVP Gaps |
|---|---|---|
| **Onboarding & First Use** | 2 of 5 done | No completion tracking on Getting Started guide; No demo/sample product seeded; No tooltips on complex fields |
| **Navigation & Search** | 3 of 5 done | Search doesn't cover rules/mappings/flows by name; No breadcrumbs on nested pages; Tab resets on product reload |
| **Product Configuration** | 2 of 4 done | No per-product settings (payload, timeout); No visual warning when editing active product |
| **Orchestrator Flow Builder** | 8 of 9 done | No flow validation before publish (can publish empty/broken flows) |
| **Mappings Configuration** | 7 of 10 done | No field path validation; No transformation preview (user sets multiply factor with no feedback); No mapping dry-run |
| **Rules Configuration** | 5 of 9 done | No condition field autocomplete; No rule test/dry-run; No action value validation (accepts text for numeric fields); Scope tags only on edit, not create |
| **Scopes** | 1 of 3 done | No state code validation (accepts anything); No bulk import |
| **Systems Registry** | 3 of 4 done | No "Test Connection" button for auth credentials |
| **Decision / Lookup Tables** | 1 of 4 done | Cannot edit existing entries; No bulk CSV import; No duplicate key warning |
| **Knowledge Base** | 1 of 3 done | "Coming soon" badge is misleading (feature works); No search/filter |
| **AI Prompts** | 2 of 4 done | No prompt testing; Can't create new prompts |
| **Custom Flows** | 2 of 3 done | No step type descriptions/help text |
| **Test Rating** | 5 of 9 done | Working data not shown in results; No saved payloads; No auto-generated sample per product; No diff view |
| **Transactions & Insights** | 6 of 9 done | No column sorting on transaction list; No export |
| **API Key Management** | 0 of 3 done | Entire page does not exist — needed for API key auth |
| **Error Handling & Feedback** | 1 of 6 done | Silent API failures; No inline form validation; Inconsistent save feedback; No retry buttons; Generic error messages |
| **Visual Design & Responsiveness** | 4 of 6 done | No mobile/tablet responsive layout; No skeleton loaders |
| **Accessibility** | 1 of 4 done | No ARIA labels on icon buttons; No focus trapping in modals; Light gray text may fail contrast |
