import { productConfig } from './client';

export interface LookupEntry {
  id: string;
  lookupTableId: string;
  key: string;
  value: Record<string, unknown>;
  createdAt: string;
}

export interface LookupTable {
  id: string;
  name: string;
  productLineCode: string;
  description?: string;
  entries: LookupEntry[];
  createdAt: string;
  updatedAt: string;
}

export const lookupTablesApi = {
  list: (productLineCode?: string) =>
    productConfig
      .get<LookupTable[]>('/lookup-tables', { params: productLineCode ? { productLineCode } : {} })
      .then((r) => r.data),

  get: (id: string) =>
    productConfig.get<LookupTable>(`/lookup-tables/${id}`).then((r) => r.data),

  create: (dto: { name: string; productLineCode?: string; description?: string }) =>
    productConfig.post<LookupTable>('/lookup-tables', dto).then((r) => r.data),

  update: (id: string, dto: { name?: string; description?: string }) =>
    productConfig.put<LookupTable>(`/lookup-tables/${id}`, dto).then((r) => r.data),

  delete: (id: string) => productConfig.delete(`/lookup-tables/${id}`),

  addEntry: (tableId: string, dto: { key: string; value: Record<string, unknown> }) =>
    productConfig.post<LookupEntry>(`/lookup-tables/${tableId}/entries`, dto).then((r) => r.data),

  deleteEntry: (entryId: string) =>
    productConfig.delete(`/lookup-tables/entries/${entryId}`),

  lookup: (tableId: string, key: string) =>
    productConfig
      .get<{ found: boolean; key: string; value?: Record<string, unknown> }>(`/lookup-tables/${tableId}/lookup/${key}`)
      .then((r) => r.data),
};
