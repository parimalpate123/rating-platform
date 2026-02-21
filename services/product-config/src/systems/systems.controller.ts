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
import { SystemsService } from './systems.service';
import type { CreateSystemDto, UpdateSystemDto } from './systems.service';

@Controller('systems')
export class SystemsController {
  constructor(private readonly systemsService: SystemsService) {}

  @Get()
  findAll() {
    return this.systemsService.findAll();
  }

  @Post()
  create(@Body() dto: CreateSystemDto) {
    return this.systemsService.create(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.systemsService.findById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSystemDto) {
    return this.systemsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.systemsService.delete(id);
  }

  @Post(':id/health-check')
  healthCheck(@Param('id') id: string) {
    return this.systemsService.healthCheck(id);
  }
}
