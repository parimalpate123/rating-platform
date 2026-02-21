import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { AiPromptsModule } from '../ai-prompts/ai-prompts.module';
import {
  RuleEntity,
  RuleConditionEntity,
  RuleActionEntity,
  ScopeTagEntity,
} from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RuleEntity,
      RuleConditionEntity,
      RuleActionEntity,
      ScopeTagEntity,
    ]),
    AiPromptsModule,
  ],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
