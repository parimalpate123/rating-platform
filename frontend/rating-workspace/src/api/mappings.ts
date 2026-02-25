import { productConfig } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TransformationType =
  | 'direct' | 'constant' | 'lookup' | 'expression'
  | 'concatenate' | 'split' | 'date' | 'number_format'
  | 'boolean' | 'conditional' | 'default' | 'multiply'
  | 'divide' | 'round' | 'per_unit' | 'aggregate' | 'custom';

export interface Mapping {
  id: string;
  name: string;
  productLineCode: string;
  direction: 'request' | 'response';
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FieldMapping {
  id: string;
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  transformationType: TransformationType;
  transformConfig: Record<string, unknown>;
  isRequired: boolean;
  defaultValue?: string;
  description?: string;
  sortOrder: number;
  createdAt: string;
}

export interface FieldMappingSuggestion {
  sourcePath: string;
  targetPath: string;
  transformationType: string;
  confidence: number; // 0.0 – 1.0
  reasoning?: string;
  fieldDirection?: string;
  dataType?: string;
  format?: string;       // e.g. YYYY-MM-DD for date type
  fieldIdentifier?: string; // e.g. policy.quoteId, usually same as targetPath
  defaultValue?: string;
}

export interface ParseResult {
  suggestions: FieldMappingSuggestion[];
  totalSuggestions: number;
  highConfidenceCount: number;
  averageConfidence: number; // 0–100 integer
  method?: 'ai' | 'heuristic';
  filename?: string;
}

// ── API Client ────────────────────────────────────────────────────────────────

export const mappingsApi = {
  list: (productLineCode?: string) =>
    productConfig.get<Mapping[]>('/mappings', { params: productLineCode ? { productLineCode } : {} }).then((r) => r.data),

  get: (id: string) =>
    productConfig.get<Mapping>(`/mappings/${id}`).then((r) => r.data),

  create: (dto: { name: string; productLineCode: string; direction: 'request' | 'response'; status?: string }) =>
    productConfig.post<Mapping>('/mappings', dto).then((r) => r.data),

  update: (id: string, dto: { name?: string; direction?: 'request' | 'response'; status?: string }) =>
    productConfig.put<Mapping>(`/mappings/${id}`, dto).then((r) => r.data),

  delete: (id: string) =>
    productConfig.delete(`/mappings/${id}`),

  // AI / text parsing
  parseText: (dto: {
    text: string;
    context?: { sourceSystem?: string; targetSystem?: string; productLine?: string };
  }) => productConfig.post<ParseResult>('/mappings/parse-text', dto).then((r) => r.data),

  // CSV/Excel upload
  parseExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return productConfig
      .post<ParseResult>('/mappings/parse-excel', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },

  // AI suggest more fields for an existing mapping
  suggestFields: (mappingId: string, context?: string) =>
    productConfig
      .post<{ suggestions: FieldMappingSuggestion[] }>(`/mappings/${mappingId}/suggest-fields`, { context })
      .then((r) => r.data),

  // Atomic: create mapping + bulk field insert
  createWithFields: (dto: {
    name: string;
    productLineCode: string;
    direction: 'request' | 'response';
    status?: string;
    fields?: Array<{
      sourcePath: string;
      targetPath: string;
      transformationType?: string;
      description?: string;
      transformConfig?: Record<string, unknown>;
      defaultValue?: string;
    }>;
  }) => productConfig.post<Mapping>('/mappings/create-with-fields', dto).then((r) => r.data),

  listFields: (mappingId: string) =>
    productConfig.get<FieldMapping[]>(`/mappings/${mappingId}/fields`).then((r) => r.data),

  createField: (mappingId: string, dto: Partial<FieldMapping>) =>
    productConfig.post<FieldMapping>(`/mappings/${mappingId}/fields`, dto).then((r) => r.data),

  updateField: (mappingId: string, fieldId: string, dto: Partial<FieldMapping>) =>
    productConfig.put<FieldMapping>(`/mappings/${mappingId}/fields/${fieldId}`, dto).then((r) => r.data),

  deleteField: (mappingId: string, fieldId: string) =>
    productConfig.delete(`/mappings/${mappingId}/fields/${fieldId}`),
};
