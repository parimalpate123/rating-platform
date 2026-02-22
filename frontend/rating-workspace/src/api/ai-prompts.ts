import { rulesService } from './client';

export interface AiPrompt {
  id: string;
  key: string;
  name: string;
  description: string | null;
  template: string;
  variables: string[];
  kbQueryTemplate: string | null;
  kbTopK: number;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const aiPromptsApi = {
  list: async (): Promise<AiPrompt[]> => {
    const { data } = await rulesService.get('/ai-prompts');
    return data;
  },

  update: async (key: string, dto: { template?: string; name?: string; description?: string }): Promise<AiPrompt> => {
    const { data } = await rulesService.put(`/ai-prompts/${key}`, dto);
    return data;
  },

  reset: async (key: string): Promise<{ message: string }> => {
    const { data } = await rulesService.delete(`/ai-prompts/${key}/reset`);
    return data;
  },
};
