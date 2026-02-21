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
} from '@nestjs/common';
import { ProductLinesService } from './product-lines.service';
import type { CreateProductLineDto, UpdateProductLineDto } from './product-lines.service';

@Controller('product-lines')
export class ProductLinesController {
  constructor(private readonly productLinesService: ProductLinesService) {}

  @Get()
  findAll() {
    return this.productLinesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateProductLineDto) {
    return this.productLinesService.create(dto);
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
