import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

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

    let targetUrl: string;
    let requestBody: any;
    let engineResponse: any;
    let rawResponse: string | null = null;
    let httpStatus = 200;

    if (isMock) {
      const mockPath = MOCK_ENDPOINT[systemCode.toLowerCase()] ?? 'mock/earnix/rate';
      targetUrl = `${this.selfUrl}/api/v1/${mockPath}`;
      requestBody = { payload: context.working, scope: context.scope };

      this.logger.log(`[Mock] Routing to ${targetUrl}`);

      const response = await axios.post(
        targetUrl,
        requestBody,
        {
          headers: { 'Content-Type': 'application/json', 'x-correlation-id': context.correlationId },
          timeout: 30000,
        },
      );
      httpStatus = response.status;

      if (typeof response.data === 'string') {
        rawResponse = response.data;
        engineResponse = { _xmlResponse: response.data };
      } else {
        engineResponse = response.data;
      }
    } else {
      const baseUrl = system.baseUrl as string;
      const ratingPath = (system.config?.ratingPath as string) ?? '/rate';
      targetUrl = `${baseUrl}${ratingPath}`;
      requestBody = context.working;

      this.logger.log(`Calling real system at ${targetUrl}`);

      const headers: Record<string, string> = {
        'Content-Type': isXmlTarget ? 'application/xml' : 'application/json',
        Accept: isXmlTarget ? 'application/xml' : 'application/json',
        'x-correlation-id': context.correlationId,
      };

      const response = await axios.post(targetUrl, requestBody, { headers, timeout: 30000 });
      httpStatus = response.status;

      if (typeof response.data === 'string' && isXmlTarget) {
        rawResponse = response.data;
        engineResponse = { _xmlResponse: response.data };
      } else {
        engineResponse = response.data;
      }
    }

    // 3 — Store on context
    context.response = engineResponse;

    const premium =
      engineResponse?.premium ??
      engineResponse?.RatingResult?.Premium ??
      null;

    return {
      status: 'completed',
      output: {
        serviceRequest: { url: targetUrl, method: 'POST', body: requestBody },
        serviceResponse: engineResponse,
        httpStatus,
        ratingEngine: systemCode,
        isMock,
        premium,
        rawXml: rawResponse ?? undefined,
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
