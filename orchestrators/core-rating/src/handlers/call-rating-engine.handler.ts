import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CallRatingEngineHandler {
  readonly type = 'call_rating_engine';
  private readonly logger = new Logger(CallRatingEngineHandler.name);

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const systemCode = config.systemCode || 'mock-engine';

    this.logger.log(`Calling rating engine: ${systemCode} for ${context.productLineCode}`);

    // Mock rating engine response — in production this would call the actual system adapter
    await new Promise(resolve => setTimeout(resolve, 50)); // simulate latency

    const mockPremium = Math.floor(Math.random() * 5000) + 500;
    const mockResponse = {
      premium: mockPremium,
      fees: Math.floor(mockPremium * 0.03),
      totalCost: Math.floor(mockPremium * 1.03),
      ratingEngine: systemCode,
      ratedAt: new Date().toISOString(),
      factors: {
        baseRate: mockPremium * 0.8,
        surcharges: mockPremium * 0.2,
      },
    };

    context.response = mockResponse;

    return {
      status: 'completed',
      output: mockResponse,
      durationMs: Date.now() - start,
    };
  }

  validate(config: any) {
    if (!config.systemCode) return { valid: false, errors: ['systemCode is required'] };
    return { valid: true };
  }

  async healthCheck() {
    return { healthy: true, details: { note: 'Mock rating engine — always healthy' } };
  }
}
