// ─── Product & Config Contracts ─────────────────────────────────────────────
// Shared types for product lines, systems, mappings, and scopes.

export interface ProductLine {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  productOwner?: string;
  technicalLead?: string;
  config: ProductLineConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ProductLineConfig {
  sourceSystem?: string;
  targetSystem?: string;
  createdVia?: 'admin-ui' | 'rating-workspace';
  [key: string]: unknown;
}

export interface SystemRegistration {
  id: string;
  code: string;
  name: string;
  type: 'source' | 'target' | 'both';
  format: 'json' | 'xml' | 'soap';
  protocol: 'rest' | 'soap' | 'grpc' | 'mock';
  baseUrl?: string;
  isMock: boolean;
  isActive: boolean;
  config?: Record<string, unknown>;
}

export interface Mapping {
  id: string;
  name: string;
  productLineCode: string;
  direction: 'request' | 'response';
  status: 'draft' | 'active';
  createdAt: string;
  updatedAt: string;
}

export type TransformationType =
  | 'direct'
  | 'constant'
  | 'lookup'
  | 'expression'
  | 'concatenate'
  | 'split'
  | 'date'
  | 'number_format'
  | 'boolean'
  | 'conditional'
  | 'default'
  | 'multiply'
  | 'divide'
  | 'round'
  | 'per_unit'
  | 'aggregate'
  | 'custom';

export interface FieldMapping {
  id: string;
  mappingId: string;
  sourcePath: string;
  targetPath: string;
  transformationType: TransformationType;
  transformConfig?: Record<string, unknown>;
  isRequired: boolean;
  defaultValue?: string;
  description?: string;
  sortOrder: number;
}

export interface ProductScope {
  id: string;
  productLineCode: string;
  scopeType: 'state' | 'coverage' | 'transaction_type';
  scopeValue: string;
  isActive: boolean;
}

export interface ScopeTag {
  id: string;
  entityType: 'rule' | 'mapping';
  entityId: string;
  scopeType: 'state' | 'coverage' | 'transaction_type';
  scopeValue: string;
}
