import axios from 'axios';

// All requests go through Vite proxy — no hardcoded ports in frontend code
const productConfig = axios.create({ baseURL: '/api/product-config' });
const rulesService  = axios.create({ baseURL: '/api/rules' });
const statusService = axios.create({ baseURL: '/api/status' });
const coreRating    = axios.create({ baseURL: '/api/core-rating' });

// Attach correlation ID to every request
[productConfig, rulesService, statusService, coreRating].forEach((client) => {
  client.interceptors.request.use((config) => {
    config.headers['x-correlation-id'] = crypto.randomUUID();
    return config;
  });
});

export { productConfig, rulesService, statusService, coreRating };
