import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionEntity, TransactionStepLogEntity } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      username: process.env.DB_USER || 'rating_user',
      password: process.env.DB_PASS || 'rating_pass',
      database: process.env.DB_NAME || 'rating_platform',
      entities: [TransactionEntity, TransactionStepLogEntity],
      synchronize: false,
      ssl: process.env.DB_HOST ? { rejectUnauthorized: false } : false,
    }),
  ],
})
export class DatabaseModule {}
