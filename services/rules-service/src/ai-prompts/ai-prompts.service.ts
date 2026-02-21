import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiPromptEntity } from './ai-prompt.entity';

@Injectable()
export class AiPromptsService {
  private readonly logger = new Logger(AiPromptsService.name);

  constructor(
    @InjectRepository(AiPromptEntity)
    private readonly repo: Repository<AiPromptEntity>,
  ) {}

  /**
   * Load a prompt template from DB and fill {{variable}} placeholders.
   * Falls back to defaultTemplate if key not found or inactive.
   */
  async buildPrompt(
    key: string,
    variables: Record<string, string>,
    defaultTemplate: string,
  ): Promise<string> {
    let template = defaultTemplate;

    try {
      const prompt = await this.repo.findOne({ where: { key, isActive: true } });
      if (prompt) {
        template = prompt.template;
      } else {
        this.logger.warn(`Prompt key "${key}" not found in DB — using hardcoded default`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to load prompt "${key}": ${err.message} — using default`);
    }

    let result = template;
    for (const [varName, value] of Object.entries(variables)) {
      result = result.replaceAll(`{{${varName}}}`, value ?? '');
    }

    // Phase 2: {{knowledge_context}} will be replaced by RAG-retrieved chunks
    result = result.replaceAll('{{knowledge_context}}', '');
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    return result;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  findAll(): Promise<AiPromptEntity[]> {
    return this.repo.find({ order: { key: 'ASC' } });
  }

  async findByKey(key: string): Promise<AiPromptEntity> {
    const prompt = await this.repo.findOne({ where: { key } });
    if (!prompt) throw new NotFoundException(`Prompt "${key}" not found`);
    return prompt;
  }

  async update(
    key: string,
    body: {
      template?: string;
      name?: string;
      description?: string;
      kbQueryTemplate?: string;
      kbTopK?: number;
      isActive?: boolean;
    },
  ): Promise<AiPromptEntity> {
    const prompt = await this.findByKey(key);
    if (body.template && body.template !== prompt.template) {
      prompt.version = (prompt.version ?? 1) + 1;
    }
    Object.assign(prompt, body);
    return this.repo.save(prompt);
  }

  async resetToDefault(key: string): Promise<{ message: string }> {
    const prompt = await this.findByKey(key);
    await this.repo.remove(prompt);
    return { message: `Prompt "${key}" removed. Hardcoded default will be used.` };
  }
}
