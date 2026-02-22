import { productConfig } from './client';

export type KBDocumentStatus = 'pending' | 'processing' | 'ready' | 'error';
export type KBDocumentType = 'pdf' | 'docx' | 'doc' | 'txt' | 'xlsx' | 'csv' | 'md' | 'json';

export interface KBDocument {
  id: string;
  filename: string;
  fileType: KBDocumentType;
  fileSizeBytes: number;
  s3Key: string;
  s3Bucket: string;
  productLineCode?: string;
  description?: string;
  tags?: string[];
  aiStatus: KBDocumentStatus;
  processingError?: string;
  chunkCount?: number;
  uploadedBy?: string;
  uploadedAt: string;
  processedAt?: string;
}

export const knowledgeBaseApi = {
  getAll: async (productLineCode?: string): Promise<KBDocument[]> => {
    const params = productLineCode ? { productLineCode } : {};
    const { data } = await productConfig.get('/knowledge-base', { params });
    return data;
  },

  upload: async (
    file: File,
    metadata: { productLineCode?: string; description?: string; tags?: string[] },
    onProgress?: (percent: number) => void,
  ): Promise<KBDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata.productLineCode) formData.append('productLineCode', metadata.productLineCode);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.tags?.length) formData.append('tags', JSON.stringify(metadata.tags));
    const { data } = await productConfig.post('/knowledge-base/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await productConfig.delete(`/knowledge-base/${id}`);
  },

  reprocess: async (id: string): Promise<KBDocument> => {
    const { data } = await productConfig.post(`/knowledge-base/${id}/reprocess`);
    return data;
  },

  getDownloadUrl: async (id: string): Promise<{ url: string; expiresAt: string }> => {
    const { data } = await productConfig.get(`/knowledge-base/${id}/download-url`);
    return data;
  },
};
