import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CallExternalApiHandler {
  readonly type = 'call_external_api';
  private readonly logger = new Logger(CallExternalApiHandler.name);
  private readonly productConfigUrl =
    process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';
  private readonly selfUrl =
    process.env['CORE_RATING_URL'] || 'http://localhost:4000';

  async execute(context: any, config: any): Promise<any> {
    const start = Date.now();
    const systemCode: string = config.systemCode || '';
    const endpoint: string = config.endpoint || '';
    const method: string = (config.method || 'POST').toUpperCase();

    this.logger.log(
      `call_external_api: system=${systemCode}, endpoint=${endpoint}, method=${method}`,
      context.correlationId,
    );

    let system: any = null;
    try {
      const { data: systems } = await axios.get(
        `${this.productConfigUrl}/api/v1/systems`,
        { headers: { 'x-correlation-id': context.correlationId }, timeout: 30000 },
      );
      system = systems.find(
        (s: any) => s.code === systemCode || s.code === systemCode.toLowerCase(),
      );
    } catch (err) {
      this.logger.warn(
        `Could not fetch systems from product-config: ${err}`,
        context.correlationId,
      );
    }

    if (!system) {
      this.logger.error(
        `System "${systemCode}" not found in registry`,
        context.correlationId,
      );
      return {
        status: 'failed',
        output: {
          serviceRequest: { systemCode, endpoint, method },
          serviceResponse: { error: `System "${systemCode}" not found in registry` },
          httpStatus: 0,
        },
      };
    }

    const isMock = system.isMock || !system.baseUrl;
    let fullUrl: string;

    if (isMock) {
      const mockPath = endpoint.replace(/^\//, '');
      fullUrl = `${this.selfUrl}/api/v1/mock/${systemCode}/${mockPath}`;
      this.logger.log(`[Mock] Routing to ${fullUrl}`, context.correlationId);
    } else {
      const baseUrl = system.baseUrl as string;
      fullUrl = `${baseUrl}${endpoint}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': system.format === 'xml' ? 'application/xml' : 'application/json',
      Accept: system.format === 'xml' ? 'application/xml' : 'application/json',
      'x-correlation-id': context.correlationId,
    };

    if (!isMock && system.authMethod === 'basic' && system.config?.auth) {
      const { username, password } = system.config.auth;
      if (username && password) {
        headers['Authorization'] =
          'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      }
    }

    this.logger.log(`${method} ${fullUrl}`, context.correlationId);

    let requestBody: any = undefined;
    if (method === 'POST' || method === 'PUT') {
      requestBody = context.working;
    }

    try {
      const response = await axios({
        method: method.toLowerCase(),
        url: fullUrl,
        data: requestBody,
        headers,
        timeout: 30000,
      });

      context.working = response.data;

      return {
        status: 'completed',
        output: {
          serviceRequest: { url: fullUrl, method, body: requestBody, systemCode },
          serviceResponse: response.data,
          httpStatus: response.status,
          isMock,
        },
      };
    } catch (err: any) {
      const status = err?.response?.status || 0;
      const responseData = err?.response?.data || err?.message || String(err);

      this.logger.error(
        `call_external_api failed: ${method} ${fullUrl} -> ${status}: ${JSON.stringify(responseData)}`,
        context.correlationId,
      );

      return {
        status: 'failed',
        output: {
          serviceRequest: { url: fullUrl, method, body: requestBody, systemCode },
          serviceResponse: responseData,
          httpStatus: status,
          isMock,
        },
      };
    }
  }

  validate(config: any) {
    const errors: string[] = [];
    if (!config.systemCode) errors.push('systemCode is required');
    if (!config.endpoint) errors.push('endpoint is required');
    return errors.length ? { valid: false, errors } : { valid: true };
  }

  async healthCheck() {
    return { healthy: true, details: { note: 'CallExternalApiHandler ready' } };
  }
}
