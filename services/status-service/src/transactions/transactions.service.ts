import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { TransactionEntity } from '../entities/transaction.entity';
import { TransactionStepLogEntity } from '../entities/transaction-step-log.entity';

export type TransactionStatus =
  | 'RECEIVED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED';

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// Convenience aliases re-exported for the controller layer
export type { TransactionEntity as Transaction } from '../entities/transaction.entity';
export type { TransactionStepLogEntity as StepLog } from '../entities/transaction-step-log.entity';

export interface CreateTransactionDto {
  correlationId?: string;
  productLineCode: string;
  requestPayload: Record<string, any>;
  scope?: Record<string, any>;
  stepCount?: number;
}

export interface UpdateTransactionDto {
  status?: TransactionStatus;
  responsePayload?: Record<string, any>;
  premiumResult?: Record<string, any>;
  errorMessage?: string;
  durationMs?: number;
  completedSteps?: number;
}

export interface CreateStepLogDto {
  stepId: string;
  stepType: string;
  stepName: string;
  stepOrder: number;
  status?: StepStatus;
  inputSnapshot?: Record<string, any>;
  outputSnapshot?: Record<string, any>;
  errorMessage?: string;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(TransactionEntity)
    private txRepo: Repository<TransactionEntity>,
    @InjectRepository(TransactionStepLogEntity)
    private stepRepo: Repository<TransactionStepLogEntity>,
  ) {}

  async create(data: CreateTransactionDto): Promise<TransactionEntity> {
    const tx = this.txRepo.create({
      correlationId: data.correlationId || randomUUID(),
      productLineCode: data.productLineCode,
      status: 'RECEIVED',
      requestPayload: data.requestPayload,
      responsePayload: null,
      scope: data.scope || null,
      premiumResult: null,
      errorMessage: null,
      durationMs: null,
      stepCount: data.stepCount || 0,
      completedSteps: 0,
    });
    return this.txRepo.save(tx);
  }

  async findAll(params: {
    productLineCode?: string;
    status?: TransactionStatus;
    from?: string;
    to?: string;
    policyNumber?: string;
    accountNumber?: string;
    instanceId?: string;
    correlationId?: string;
  }): Promise<TransactionEntity[]> {
    const {
      productLineCode,
      status,
      from,
      to,
      policyNumber,
      accountNumber,
      instanceId,
      correlationId,
    } = params;

    const statusVal = typeof status === 'string' ? status.trim() : status;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .orderBy('tx.created_at', 'DESC')
      .take(200);

    // Build WHERE conditions; use .where() for first, .andWhere() for rest
    const conditions: string[] = [];
    const parameters: Record<string, unknown> = {};

    if (productLineCode) {
      conditions.push('tx.product_line_code = :productLineCode');
      parameters.productLineCode = productLineCode;
    }
    if (statusVal) {
      conditions.push('tx.status = :filterStatus');
      parameters.filterStatus = statusVal;
    }
    if (from) {
      conditions.push('tx.created_at >= :from');
      parameters.from = new Date(from);
    }
    if (to) {
      conditions.push('tx.created_at <= :to');
      parameters.to = new Date(to);
    }
    if (correlationId) {
      conditions.push('tx.correlation_id = :correlationId');
      parameters.correlationId = correlationId;
    }
    if (policyNumber) {
      const term = `%${policyNumber}%`;
      conditions.push(
        "(tx.request_payload->>'policyNumber' ILIKE :policyTerm OR tx.request_payload->'policy'->>'policyNumber' ILIKE :policyTerm)",
      );
      parameters.policyTerm = term;
    }
    if (accountNumber) {
      const term = `%${accountNumber}%`;
      conditions.push(
        "(tx.request_payload->>'accountNumber' ILIKE :accountTerm OR tx.request_payload->'account'->>'accountNumber' ILIKE :accountTerm)",
      );
      parameters.accountTerm = term;
    }
    if (instanceId) {
      const term = `%${instanceId}%`;
      conditions.push(
        "(tx.request_payload->>'instanceId' ILIKE :instanceTerm OR tx.request_payload->>'instance_id' ILIKE :instanceTerm)",
      );
      parameters.instanceTerm = term;
    }

    if (conditions.length > 0) {
      qb.where(conditions.join(' AND '), parameters);
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<TransactionEntity> {
    const tx = await this.txRepo.findOne({ where: { id } });
    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return tx;
  }

  async update(
    id: string,
    data: UpdateTransactionDto,
  ): Promise<TransactionEntity> {
    const tx = await this.findOne(id);
    Object.assign(tx, data);
    return this.txRepo.save(tx);
  }

  async getStepLogs(transactionId: string): Promise<TransactionStepLogEntity[]> {
    await this.findOne(transactionId);
    return this.stepRepo.find({
      where: { transactionId },
      order: { stepOrder: 'ASC' },
    });
  }

  async addStepLog(
    transactionId: string,
    data: CreateStepLogDto,
  ): Promise<TransactionStepLogEntity> {
    await this.findOne(transactionId);
    const log = this.stepRepo.create({
      transactionId,
      stepId: data.stepId,
      stepType: data.stepType,
      stepName: data.stepName,
      stepOrder: data.stepOrder,
      status: data.status || 'PENDING',
      inputSnapshot: data.inputSnapshot || null,
      outputSnapshot: data.outputSnapshot || null,
      errorMessage: data.errorMessage || null,
      durationMs: data.durationMs || null,
      startedAt: data.startedAt ? new Date(data.startedAt) : new Date(),
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
    });
    return this.stepRepo.save(log);
  }
}
