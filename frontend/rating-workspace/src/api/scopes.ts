import { productConfig } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScopeType = 'state' | 'coverage' | 'transaction_type';

export interface ProductScope {
  id: string;
  productLineCode: string;
  scopeType: ScopeType;
  scopeValue: string;
  isActive: boolean;
  createdAt: string;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const scopesApi = {
  list: (productLineCode: string) =>
    productConfig.get<ProductScope[]>(`/product-lines/${productLineCode}/scopes`).then((r) => r.data),

  create: (productLineCode: string, dto: { scopeType: ScopeType; scopeValue: string }) =>
    productConfig.post<ProductScope>(`/product-lines/${productLineCode}/scopes`, dto).then((r) => r.data),

  update: (productLineCode: string, id: string, dto: { isActive?: boolean }) =>
    productConfig.put<ProductScope>(`/product-lines/${productLineCode}/scopes/${id}`, dto).then((r) => r.data),

  delete: (productLineCode: string, id: string) =>
    productConfig.delete(`/product-lines/${productLineCode}/scopes/${id}`).then((r) => r.data),
};
