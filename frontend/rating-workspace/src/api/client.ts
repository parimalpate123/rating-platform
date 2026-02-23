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

// Attach correlation ID to every request (use shared UUID helper for HTTP/insecure contexts)
[productConfig, rulesService, statusService, coreRating].forEach((client) => {
  client.interceptors.request.use((config) => {
    config.headers['x-correlation-id'] = randomUUID();
    return config;
  });
});

export { productConfig, rulesService, statusService, coreRating };
