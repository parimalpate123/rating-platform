import { productConfig } from './client';

export interface ActivityEntry {
  id: string;
  productLineCode: string;
  entityType: string;
  entityId?: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export const activityApi = {
  list: (productLineCode: string, limit = 50) =>
    productConfig
      .get<ActivityEntry[]>(`/product-lines/${productLineCode}/activity`, { params: { limit } })
      .then((r) => r.data),
};
