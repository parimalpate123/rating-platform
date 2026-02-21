import { Controller, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { AiPromptsService } from './ai-prompts.service';

@Controller('ai-prompts')
export class AiPromptsController {
  constructor(private readonly aiPromptsService: AiPromptsService) {}

  @Get()
  findAll() {
    return this.aiPromptsService.findAll();
  }

  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.aiPromptsService.findByKey(key);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body()
    body: {
      template?: string;
      name?: string;
      description?: string;
      kbQueryTemplate?: string;
      kbTopK?: number;
      isActive?: boolean;
    },
  ) {
    return this.aiPromptsService.update(key, body);
  }

  @Delete(':key/reset')
  resetToDefault(@Param('key') key: string) {
    return this.aiPromptsService.resetToDefault(key);
  }
}
