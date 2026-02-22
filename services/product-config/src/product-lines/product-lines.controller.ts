import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ProductLinesService } from './product-lines.service';
import type { CreateProductLineDto, UpdateProductLineDto } from './product-lines.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Controller('product-lines')
export class ProductLinesController {
  constructor(
    private readonly productLinesService: ProductLinesService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get()
  findAll() {
    return this.productLinesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProductLineDto) {
    return this.productLinesService.create(dto);
  }

  @Get(':code/activity')
  getActivity(
    @Param('code') code: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLog.findByProduct(code, limit ? parseInt(limit, 10) : 50);
  }

  @Get(':code')
  findByCode(@Param('code') code: string) {
    return this.productLinesService.findByCode(code);
  }

  @Put(':code')
  update(@Param('code') code: string, @Body() dto: UpdateProductLineDto) {
    return this.productLinesService.update(code, dto);
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('code') code: string) {
    await this.productLinesService.delete(code);
  }
}
