import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiPromptEntity } from './ai-prompt.entity';
import { AiPromptsService } from './ai-prompts.service';
import { AiPromptsController } from './ai-prompts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AiPromptEntity])],
  controllers: [AiPromptsController],
  providers: [AiPromptsService],
  exports: [AiPromptsService],
})
export class AiPromptsModule {}
