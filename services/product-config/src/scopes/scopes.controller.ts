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
import { ScopesService } from './scopes.service';
import type { CreateScopeDto, UpdateScopeDto } from './scopes.service';

@Controller('product-lines/:code/scopes')
export class ScopesController {
  constructor(private readonly scopesService: ScopesService) {}

  @Get()
  findByProductLine(@Param('code') code: string) {
    return this.scopesService.findByProductLine(code);
  }

  @Post()
  create(@Param('code') code: string, @Body() dto: CreateScopeDto) {
    return this.scopesService.create(code, dto);
  }

  @Put(':id')
  update(
    @Param('code') code: string,
    @Param('id') id: string,
    @Body() dto: UpdateScopeDto,
  ) {
    return this.scopesService.update(code, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('code') code: string, @Param('id') id: string) {
    await this.scopesService.delete(code, id);
  }
}
