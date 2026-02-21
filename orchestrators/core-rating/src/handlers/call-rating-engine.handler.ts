import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// System code → local mock endpoint path (used when isMock=true or no baseUrl set)
const MOCK_ENDPOINT: Record<string, string> = {
  earnix: 'mock/earnix/rate',
  'cgi-ratabase': 'mock/ratabase/rate',
  'duck-creek': 'mock/duck-creek/rate',
};

@Injectable()
export class CallRatingEngineHandler {
  readonly type = 'call_rating_engine';
  private readonly logger = new Logger(CallRatingEngineHandler.name);
  private readonly productConfigUrl =
    process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';
  private readonly selfUrl =
    process.env['CORE_RATING_URL'] || 'http://localhost:4000';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const systemCode: string = config.systemCode || 'earnix';

    this.logger.log(
      `Calling rating engine: ${systemCode} for ${context.productLineCode}`,
    );

    // 1 — Fetch system config from product-config
    let system: any = null;
    try {
      const { data: systems } = await axios.get(
        `${this.productConfigUrl}/api/v1/systems`,
      );
      system = systems.find(
        (s: any) =>
          s.code === systemCode || s.code === systemCode.toLowerCase(),
      );
    } catch (err) {
      this.logger.warn(
        `Could not fetch systems from product-config: ${err} — using mock`,
      );
    }

    // 2 — Determine endpoint and format
    const isMock = !system || system.isMock || !system.baseUrl;
    const format: string = system?.format ?? 'json';
    const isXmlTarget = format === 'xml';

    let engineResponse: any;
    let rawResponse: string | null = null;

    if (isMock) {
      // Route to local mock endpoint
      const mockPath = MOCK_ENDPOINT[systemCode.toLowerCase()] ?? 'mock/earnix/rate';
      const mockUrl = `${this.selfUrl}/api/v1/${mockPath}`;
      this.logger.log(`[Mock] Routing to ${mockUrl}`);

      const { data } = await axios.post(
        mockUrl,
        { payload: context.working, scope: context.scope },
        { headers: { 'Content-Type': 'application/json' } },
      );

      if (typeof data === 'string') {
        // XML response from mock ratabase
        rawResponse = data;
        engineResponse = { _xmlResponse: data };
      } else {
        engineResponse = data;
      }
    } else {
      // Route to real system baseUrl
      const baseUrl = system.baseUrl as string;
      const ratingPath = (system.config?.ratingPath as string) ?? '/rate';
      const targetUrl = `${baseUrl}${ratingPath}`;

      this.logger.log(`Calling real system at ${targetUrl}`);

      const headers: Record<string, string> = {
        'Content-Type': isXmlTarget ? 'application/xml' : 'application/json',
        Accept: isXmlTarget ? 'application/xml' : 'application/json',
      };

      const { data } = await axios.post(
        targetUrl,
        context.working,
        { headers },
      );

      if (typeof data === 'string' && isXmlTarget) {
        rawResponse = data;
        engineResponse = { _xmlResponse: data };
      } else {
        engineResponse = data;
      }
    }

    // 3 — Store on context: keep working data and set response
    context.response = engineResponse;

    // If the engine returned a numeric premium, surface it for status recording
    const premium =
      engineResponse?.premium ??
      engineResponse?.RatingResult?.Premium ??
      null;

    return {
      status: 'completed',
      output: {
        ratingEngine: systemCode,
        isMock,
        premium,
        rawXml: rawResponse ?? undefined,
        response: engineResponse,
      },
      durationMs: Date.now() - start,
    };
  }

  validate(config: any) {
    if (!config.systemCode)
      return { valid: false, errors: ['systemCode is required'] };
    return { valid: true };
  }

  async healthCheck() {
    return { healthy: true, details: { note: 'CallRatingEngineHandler ready' } };
  }
}
