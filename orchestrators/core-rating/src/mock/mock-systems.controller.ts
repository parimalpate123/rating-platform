// ─── Mock Rating Engine Endpoints ──────────────────────────────────────────
// Simulates external rating systems for local development and testing.
// CallRatingEngineHandler routes to these when a system is flagged as mock
// or when no real baseUrl is configured.

import { Controller, Post, Body, Logger } from '@nestjs/common';

@Controller('mock')
export class MockSystemsController {
  private readonly logger = new Logger(MockSystemsController.name);

  // ── Mock Earnix (JSON in / JSON out) ──────────────────────────────────────
  @Post('earnix/rate')
  earnixRate(@Body() body: any) {
    this.logger.log(`[Mock Earnix] Received rating request`);
    const payload = body?.payload ?? body ?? {};
    const revenue = payload?.policy?.annualRevenue ?? payload?.insured?.annualRevenue ?? 1000000;
    const employeeCount = payload?.policy?.employeeCount ?? payload?.insured?.employeeCount ?? 10;
    const state = payload?.policy?.state ?? payload?.insured?.state ?? 'NY';

    const baseRate = 2500;
    const revenueFactor = Math.log10(Math.max(revenue, 1)) / 6;
    const stateSurcharge: Record<string, number> = { NY: 1.12, CA: 1.15, TX: 1.05, FL: 1.10 };
    const stateMultiplier = stateSurcharge[state] ?? 1.0;
    const premium = Math.round(baseRate * revenueFactor * stateMultiplier * (1 + employeeCount * 0.002));
    const fees = Math.round(premium * 0.03);

    return {
      ratingEngine: 'earnix',
      requestId: `EARNIX-${Date.now()}`,
      status: 'success',
      premium,
      fees,
      totalCost: premium + fees,
      breakdown: {
        baseRate,
        revenueFactor: Math.round(revenueFactor * 100) / 100,
        stateMultiplier,
        employeeLoadPct: Math.round(employeeCount * 0.2),
      },
      ratedAt: new Date().toISOString(),
    };
  }

  // ── Mock CGI Ratabase (JSON in / XML out) ─────────────────────────────────
  @Post('ratabase/rate')
  ratabaseRate(@Body() body: any) {
    this.logger.log(`[Mock Ratabase] Received rating request`);
    const payload = body?.payload ?? body ?? {};
    const revenue = payload?.policy?.annualRevenue ?? payload?.insured?.annualRevenue ?? 1000000;
    const state = payload?.policy?.state ?? payload?.insured?.state ?? 'NY';
    const premium = Math.round(3000 + revenue * 0.001 + (state === 'NY' ? 500 : 0));
    const fees = Math.round(premium * 0.025);

    // Return XML as a string (CGI Ratabase responds with XML)
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RatabaseResponse>
  <RequestId>RATABASE-${Date.now()}</RequestId>
  <Status>SUCCESS</Status>
  <RatingResult>
    <Premium>${premium}</Premium>
    <Fees>${fees}</Fees>
    <TotalCost>${premium + fees}</TotalCost>
    <Breakdown>
      <BaseRate>3000</BaseRate>
      <RevenueSurcharge>${Math.round(revenue * 0.001)}</RevenueSurcharge>
      <StateLoad>${state === 'NY' ? 500 : 0}</StateLoad>
    </Breakdown>
    <RatingEngine>CGI_Ratabase</RatingEngine>
    <RatedAt>${new Date().toISOString()}</RatedAt>
  </RatingResult>
</RatabaseResponse>`;

    return xml;
  }

  // ── Mock GW PolicyCenter init-rate ──────────────────────────────────────────
  // Support both /init-rate and /v1/init-rate (call_external_api uses endpoint as configured in step)
  @Post('gw-policycenter/init-rate')
  gwInitRate(@Body() body: any) {
    return this.gwInitRateHandler(body);
  }

  @Post('gw-policycenter/v1/init-rate')
  gwInitRateV1(@Body() body: any) {
    return this.gwInitRateHandler(body);
  }

  private gwInitRateHandler(body: any) {
    this.logger.log(`[Mock GW PolicyCenter] Received init-rate request`);
    const payload = body?.payload ?? body ?? {};
    const policyNumber = payload?.policyNumber || `POL-${Date.now()}`;
    const productLineCode = payload?.productLineCode || 'unknown';
    const transactionType = payload?.transactionType || 'new_business';

    return {
      system: 'gw-policycenter',
      endpoint: '/v1/init-rate',
      status: 'accepted',
      transactionId: `GW-${Date.now()}`,
      policyNumber,
      productLineCode,
      transactionType,
      ratingSessionId: `RS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      message: 'Rating session initialized successfully',
      createdAt: new Date().toISOString(),
    };
  }

  // ── Mock Duck Creek (JSON in / JSON out) ──────────────────────────────────
  @Post('duck-creek/rate')
  duckCreekRate(@Body() body: any) {
    this.logger.log(`[Mock Duck Creek] Received rating request`);
    const payload = body?.payload ?? body ?? {};
    const limit = payload?.coverage?.limit ?? 1000000;
    const premium = Math.round(limit * 0.003 + 800);

    return {
      ratingEngine: 'duck-creek',
      transactionId: `DC-${Date.now()}`,
      premium,
      fees: Math.round(premium * 0.04),
      totalCost: Math.round(premium * 1.04),
      ratedAt: new Date().toISOString(),
    };
  }
}
