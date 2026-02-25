# InsuRateConnect — Step-by-Step Usage Guide

This guide walks through everything you need to go from a fresh start to running a live test rating request in the UI.

---

## 1. Start the System

### Step 1 — Start infrastructure (Postgres, Redis, MinIO)

```bash
cd ~/code/rating-platform
./scripts/start-infra.sh
```

Wait ~10 seconds for Postgres to be ready.

### Step 2 — Start all backend services

```bash
./scripts/start-all.sh
```

This starts all 6 NestJS services in the background:

| Service | Port | Purpose |
|---|---|---|
| core-rating | 4000 | Main execution engine |
| line-rating | 4001 | Orchestrator definitions |
| product-config | 4010 | Products, systems, mappings |
| transform | 4011 | JSON ↔ XML conversion |
| rules | 4012 | Business rules evaluation |
| status | 4013 | Transaction logging |

> Wait ~5–10 seconds for all services to start up.

### Step 3 — Start the UI

```bash
./scripts/start-ui.sh
```

Open your browser to: **http://localhost:4200**

---

## 2. Explore Systems (Pre-Seeded — No Action Required)

Navigate to **Systems** in the left sidebar.

On first start, the `product-config` service auto-seeds 5 built-in systems:

| Code | Name | Type | Format |
|---|---|---|---|
| gw-policycenter | GW PolicyCenter | source | JSON |
| cgi-ratabase | CGI Ratabase | target | XML |
| earnix | Earnix | target | JSON |
| duck-creek | Duck Creek | both | JSON |
| salesforce | Salesforce | source | JSON |

These are the systems you can assign as source/target when creating a product line. You can click **Check** on any row to verify connectivity (mock systems return healthy).

> No action needed here — just verify the list loaded.

---

## 3. Create a Product Line

### Step 1 — Open the New Product modal

Click **New Product Line** in the top-right of the Products page, OR click the **+ New Product** link at the bottom of the sidebar Product Lines section.

### Step 2 — Fill in the form

| Field | Required | Notes |
|---|---|---|
| **Code** | Yes | Short identifier, e.g. `GL`, `IMCE`, `BOP`. Auto-uppercased. |
| **Name** | Yes | Full product name, e.g. `General Liability` |
| Description | No | Brief description |
| **Source System** | Recommended | Where the rating request comes from (e.g. GW PolicyCenter) |
| **Target System** | Recommended | The rating engine (e.g. CGI Ratabase → XML flow, Earnix → JSON flow) |
| Product Owner | No | Person name |
| Technical Lead | No | Person name |

**Important:** The target system determines the orchestrator template:
- **CGI Ratabase** → 8-step XML flow (includes JSON→XML and XML→JSON transform steps)
- **Earnix / Custom** → 5-step JSON flow (no format transform steps)

### Step 3 — Click "Create Product Line"

The product appears in the sidebar and on the Products grid.

---

## 4. Generate the Orchestrator

### Step 1 — Open the product workspace

Click **Open Workspace** on the product card, or click the product name in the sidebar.

### Step 2 — Go to the Orchestrator tab

Click the **Orchestrator** tab at the top of the product detail page.

You will see: *"No Orchestrator Configured"*.

### Step 3 — Click "Auto-Generate Flow"

The system reads the target system format and creates the appropriate step sequence:

**For CGI Ratabase (XML):**
```
Step 1  field_mapping       Map GW Request Fields
Step 2  field_mapping       Construct Rating Engine JSON
Step 3  apply_rules         Pre-Rating Rules
Step 4  format_transform    JSON → XML
Step 5  call_rating_engine  Call CGI Ratabase
Step 6  format_transform    XML → JSON
Step 7  field_mapping       Map Response to GW
Step 8  apply_rules         Post-Rating Rules
```

**For Earnix / JSON:**
```
Step 1  field_mapping       Map GW Request Fields
Step 2  apply_rules         Pre-Rating Rules
Step 3  call_rating_engine  Call Earnix
Step 4  field_mapping       Map Response to GW
Step 5  apply_rules         Post-Rating Rules
```

Each step shows:
- A colored type badge (blue = field_mapping, green = apply_rules, orange = format_transform, purple = call_rating_engine)
- Step name and config preview
- Green checkmark = active

> The orchestrator is created in `draft` status. You can re-generate at any time (this replaces all existing steps).

---

## 5. Run a Test Rating

### Step 1 — Navigate to Test Rating

Click **Test Rating** (⚡ icon) in the left sidebar under Monitoring, or go to **http://localhost:4200/test**.

### Step 2 — Select your product

In the **Product Line** dropdown, select the product you just created.

### Step 3 — Set scope (optional)

| Field | Example | Notes |
|---|---|---|
| State | `NY` | Optional — used for scope-based rule filtering |
| Coverage | `BOP` | Optional |
| Transaction | `new_business` | Defaults to new_business |

### Step 4 — Edit the payload (optional)

The default payload is a sample BOP policy. You can edit the JSON to match your product's expected input format. The payload must be valid JSON.

### Step 5 — Click "Run Rating"

The request is sent to `core-rating` which:
1. Fetches the orchestrator steps from `line-rating`
2. Creates a transaction record in `status-service`
3. Executes each step in order through the handler registry
4. Returns the full result with step trace

### Step 6 — Review the results

**Summary card shows:**
- Status (completed / failed)
- Premium (if mock returned one — displayed as a green highlight)
- Transaction ID and Correlation ID
- Total duration and step count

**Step Trace (expandable):**
- Click any step row to expand it
- Shows: step type, duration, output data or error message
- Green ✓ = completed, empty circle = skipped, red ✗ = failed

> **Note:** Field mapping, apply_rules, and format_transform steps gracefully skip if the downstream services are unreachable. The `call_rating_engine` step is mocked and returns a random premium between $500–$5,500 with a simulated 50ms delay.

---

## 6. View Transaction History

Navigate to **Transactions** in the sidebar.

Every test rating run creates a transaction record here. You can:
- **Filter by product code** using the search input
- **Filter by status** using the dropdown (COMPLETED, FAILED, etc.)
- **Click any row** to expand and see the step-by-step log with status, duration, and any errors

---

## What's Coming Next (Phase 3)

The following tabs on the Product Detail page currently show "Coming Soon":

| Tab | What It Will Allow |
|---|---|
| **Mappings** | Configure field-level transforms for each mapping step (source path → target path, transform type) |
| **Rules** | Create and manage business rules with conditions and actions (pre-rating / post-rating) |
| **Scopes** | Tag rules and mappings with state/coverage/transaction_type scope constraints |

Once Phase 3 is complete, the field mapping and rules steps will execute real logic instead of gracefully skipping.

---

## Troubleshooting

**"No products yet" on Test Rating page**
→ Services may not be running. Run `./scripts/start-all.sh` and wait a few seconds, then refresh.

**Product created but orchestrator says "No Orchestrator Configured"**
→ The `line-rating` service may not be running. Check with `curl http://localhost:4001/health`.

**Test rating fails with error**
→ Check that `core-rating` (port 4000) and `line-rating` (port 4001) are both running. The other services are optional — steps skip gracefully when unavailable.

**Transactions page empty after running a test**
→ The `status-service` (port 4013) may not be running. Transactions are optional — the test rating result panel shows full step trace regardless.

**Port conflict**
→ This project uses non-standard ports to avoid conflict with other stacks:
- Postgres: `5433` (not 5432)
- Redis: `6380` (not 6379)
- MinIO: `9010/9011` (not 9000/9001)
