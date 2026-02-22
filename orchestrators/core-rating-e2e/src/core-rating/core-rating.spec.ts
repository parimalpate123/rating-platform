import axios from 'axios';

// Service URLs — core-rating base URL comes from axios.defaults.baseURL (set in test-setup.ts).
// Sibling services are addressed explicitly so the test is self-contained.
const PRODUCT_CONFIG =
  `http://localhost:${process.env['PRODUCT_CONFIG_PORT'] || 4010}/api/v1`;
const LINE_RATING =
  `http://localhost:${process.env['LINE_RATING_PORT'] || 4001}/api/v1`;

const TEST_PRODUCT = 'e2e-smoke-test';

// ── Fixture setup / teardown ──────────────────────────────────────────────────

beforeAll(async () => {
  // 1. Create the product line (idempotent — ignore 409 conflict)
  await axios
    .post(`${PRODUCT_CONFIG}/product-lines`, {
      code: TEST_PRODUCT,
      name: 'E2E Smoke Test',
      description: 'Created by core-rating-e2e smoke test',
    })
    .catch(() => {});

  // 2. Create an orchestrator flow (idempotent — ignore conflicts)
  await axios
    .post(`${LINE_RATING}/orchestrators/${TEST_PRODUCT}/flows`, {
      name: 'Smoke Flow',
      endpointPath: 'rate',
    })
    .catch(() => {});

  // 3. Add step 1: apply_rules — no condition, always runs
  await axios
    .post(`${LINE_RATING}/orchestrators/${TEST_PRODUCT}/flow/rate/steps`, {
      stepType: 'apply_rules',
      name: 'Apply Rules',
      config: { scope: 'pre_rating' },
      stepOrder: 1,
    })
    .catch(() => {});

  // 4. Add step 2: apply_rules with a condition that will NOT be met when state='CA'
  //    (condition: state must equal 'TX') — should be skipped in tests
  await axios
    .post(`${LINE_RATING}/orchestrators/${TEST_PRODUCT}/flow/rate/steps`, {
      stepType: 'apply_rules',
      name: 'Texas-Only Rules',
      config: {
        scope: 'pre_rating',
        condition: { field: 'state', operator: 'eq', value: 'TX' },
      },
      stepOrder: 2,
    })
    .catch(() => {});
});

afterAll(async () => {
  // Remove the orchestrator flow so successive runs start clean
  await axios
    .delete(`${LINE_RATING}/orchestrators/${TEST_PRODUCT}/flow/rate`)
    .catch(() => {});
});

// ── Health ────────────────────────────────────────────────────────────────────

describe('Health', () => {
  it('GET /api/v1/health returns 200', async () => {
    const res = await axios.get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('POST /api/v1/rate/:productLineCode — happy path', () => {
  it('returns a structured response with at least one step result', async () => {
    const res = await axios.post(`/api/v1/rate/${TEST_PRODUCT}`, {
      scope: { state: 'CA', coverage: 'comprehensive', transactionType: 'new_business' },
      payload: {
        state: 'CA',
        insured: { name: 'Jane Smoke', age: 35 },
        vehicle: { year: 2022, make: 'Honda', model: 'Civic' },
      },
    });

    expect(res.status).toBe(200);

    // Top-level shape
    expect(res.data).toMatchObject({
      productLineCode: TEST_PRODUCT,
      correlationId: expect.any(String),
      status: expect.stringMatching(/^(completed|failed)$/),
      stepResults: expect.any(Array),
      totalDurationMs: expect.any(Number),
    });

    // At least one step was executed
    expect(res.data.stepResults.length).toBeGreaterThan(0);

    // Every step carries the required fields
    for (const step of res.data.stepResults) {
      expect(step).toMatchObject({
        stepType: expect.any(String),
        stepName: expect.any(String),
        status: expect.stringMatching(/^(completed|failed|skipped)$/),
        durationMs: expect.any(Number),
      });
    }
  });

  it('returns 404 when product has no orchestrator', async () => {
    await expect(
      axios.post('/api/v1/rate/no-such-product-xyz', { payload: {} }),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });
});

// ── Conditional steps ─────────────────────────────────────────────────────────

describe('Conditional steps', () => {
  it('skips a step whose condition is not met', async () => {
    // state='CA' — "Texas-Only Rules" step has condition state eq 'TX', so it must be skipped
    const res = await axios.post(`/api/v1/rate/${TEST_PRODUCT}`, {
      payload: { state: 'CA' },
    });

    expect(res.status).toBe(200);

    const texasStep = res.data.stepResults.find(
      (s: any) => s.stepName === 'Texas-Only Rules',
    );
    expect(texasStep).toBeDefined();
    expect(texasStep.status).toBe('skipped');
    expect(texasStep.durationMs).toBe(0);
  });

  it('runs a conditional step when its condition is met', async () => {
    // state='TX' — "Texas-Only Rules" step condition IS met, so it must execute
    const res = await axios.post(`/api/v1/rate/${TEST_PRODUCT}`, {
      payload: { state: 'TX' },
    });

    expect(res.status).toBe(200);

    const texasStep = res.data.stepResults.find(
      (s: any) => s.stepName === 'Texas-Only Rules',
    );
    expect(texasStep).toBeDefined();
    expect(texasStep.status).not.toBe('skipped');
  });
});

// ── Orchestrator versioning ───────────────────────────────────────────────────

describe('Orchestrator versioning', () => {
  it('orchestrator response includes a version field', async () => {
    const res = await axios.get(
      `${LINE_RATING}/orchestrators/${TEST_PRODUCT}/flow/rate`,
    );
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      version: expect.any(Number),
    });
    expect(res.data.version).toBeGreaterThanOrEqual(1);
  });
});
