import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionEntity, TransactionStepLogEntity } from '../entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity, TransactionStepLogEntity]),
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
