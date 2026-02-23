import axios from 'axios';
import { randomUUID } from '../lib/uuid';

// Production: /api/v1 so ALB path-based routing works. Dev: use proxy paths so Vite proxy rewrites to backends.
const apiBase = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  ? { productConfig: '/api/product-config', rules: '/api/rules', status: '/api/status', core: '/api/core-rating' }
  : { productConfig: '/api/v1', rules: '/api/v1', status: '/api/v1', core: '/api/v1' };
const productConfig = axios.create({ baseURL: apiBase.productConfig });
const rulesService  = axios.create({ baseURL: apiBase.rules });
const statusService = axios.create({ baseURL: apiBase.status });
const coreRating    = axios.create({ baseURL: apiBase.core });

/** Retry on 502/503/504 (e.g. ALB has no healthy target). Only for idempotent methods to avoid double-submit. */
const RETRYABLE_STATUS = [502, 503, 504];
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function addRetryInterceptor(instance: ReturnType<typeof axios.create>) {
  instance.interceptors.response.use(
    (r) => r,
    async (err) => {
      const config = err.config as typeof err.config & { __retryCount?: number };
      if (!config) return Promise.reject(err);
      const status = err.response?.status;
      const method = (config.method ?? 'get').toLowerCase();
      const idempotent = ['get', 'head', 'options'].includes(method);
      const retryCount = config.__retryCount ?? 0;
      if (
        retryCount >= MAX_RETRIES ||
        !idempotent ||
        !status ||
        !RETRYABLE_STATUS.includes(status)
      ) {
        return Promise.reject(err);
      }
      config.__retryCount = retryCount + 1;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return instance.request(config);
    },
  );
}

[productConfig, rulesService, statusService, coreRating].forEach((client) => {
  client.interceptors.request.use((config) => {
    config.headers['x-correlation-id'] = randomUUID();
    return config;
  });
  addRetryInterceptor(client);
});

export { productConfig, rulesService, statusService, coreRating, addRetryInterceptor };
