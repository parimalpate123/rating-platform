import { productConfig } from './client';

export interface ProductLine {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'inactive' | 'archived';
  productOwner?: string;
  technicalLead?: string;
  config: { sourceSystem?: string; targetSystem?: string; [key: string]: unknown };
  createdAt: string;
  updatedAt: string;
}

export const productsApi = {
  list: () => productConfig.get<ProductLine[]>('/product-lines').then(r => r.data),
  get: (code: string) => productConfig.get<ProductLine>(`/product-lines/${code}`).then(r => r.data),
  create: (data: Partial<ProductLine>) => productConfig.post<ProductLine>('/product-lines', data).then(r => r.data),
  update: (code: string, data: Partial<ProductLine>) => productConfig.put<ProductLine>(`/product-lines/${code}`, data).then(r => r.data),
  delete: (code: string) => productConfig.delete(`/product-lines/${code}`).then(r => r.data),
};
