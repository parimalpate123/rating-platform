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
  Transaction,
  StepLog,
  CreateTransactionDto,
  UpdateTransactionDto,
  CreateStepLogDto,
} from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Body() body: CreateTransactionDto): Transaction {
    return this.transactionsService.create(body);
  }

  @Get()
  findAll(
    @Query('productLineCode') productLineCode?: string
  ): Transaction[] {
    return this.transactionsService.findAll(productLineCode);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Transaction {
    return this.transactionsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateTransactionDto
  ): Transaction {
    return this.transactionsService.update(id, body);
  }

  @Get(':id/steps')
  getStepLogs(@Param('id') id: string): StepLog[] {
    return this.transactionsService.getStepLogs(id);
  }

  @Post(':id/steps')
  addStepLog(
    @Param('id') id: string,
    @Body() body: CreateStepLogDto
  ): StepLog {
    return this.transactionsService.addStepLog(id, body);
  }
}
