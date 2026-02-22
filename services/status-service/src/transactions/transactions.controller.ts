import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import {
  TransactionsService,
  type Transaction,
  type StepLog,
  type CreateTransactionDto,
  type UpdateTransactionDto,
  type CreateStepLogDto,
} from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Body() body: CreateTransactionDto): Promise<Transaction> {
    return this.transactionsService.create(body);
  }

  @Get()
  findAll(
    @Query('productLineCode') productLineCode?: string,
    @Query('status') status?: string | string[],
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('policyNumber') policyNumber?: string,
    @Query('accountNumber') accountNumber?: string,
    @Query('instanceId') instanceId?: string,
    @Query('correlationId') correlationId?: string,
  ): Promise<Transaction[]> {
    const statusVal = Array.isArray(status) ? status[0] : status;
    return this.transactionsService.findAll({
      productLineCode,
      status: statusVal as any,
      from,
      to,
      policyNumber,
      accountNumber,
      instanceId,
      correlationId,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Transaction> {
    return this.transactionsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<Transaction> {
    return this.transactionsService.update(id, body);
  }

  @Get(':id/steps')
  getStepLogs(@Param('id') id: string): Promise<StepLog[]> {
    return this.transactionsService.getStepLogs(id);
  }

  @Post(':id/steps')
  addStepLog(
    @Param('id') id: string,
    @Body() body: CreateStepLogDto,
  ): Promise<StepLog> {
    return this.transactionsService.addStepLog(id, body);
  }
}
