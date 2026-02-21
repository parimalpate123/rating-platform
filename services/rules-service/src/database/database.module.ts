import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  RuleActionEntity,
  RuleConditionEntity,
  RuleEntity,
  ScopeTagEntity,
} from '../entities';
import { AiPromptEntity } from '../ai-prompts/ai-prompt.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      username: process.env.DB_USER || 'rating_user',
      password: process.env.DB_PASS || 'rating_pass',
      database: process.env.DB_NAME || 'rating_platform',
      entities: [RuleEntity, RuleConditionEntity, RuleActionEntity, ScopeTagEntity, AiPromptEntity],
      synchronize: false,
    }),
  ],
})
export class DatabaseModule {}
