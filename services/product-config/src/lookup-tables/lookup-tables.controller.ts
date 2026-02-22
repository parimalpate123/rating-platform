import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { LookupTablesService } from './lookup-tables.service';

@Controller('lookup-tables')
export class LookupTablesController {
  constructor(private readonly svc: LookupTablesService) {}

  @Get()
  findAll(@Query('productLineCode') productLineCode?: string) {
    return this.svc.findAll(productLineCode);
  }

  @Post()
  create(@Body() dto: { name: string; productLineCode?: string; description?: string }) {
    return this.svc.create(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: { name?: string; description?: string }) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
  }

  // ── Entries ────────────────────────────────────────────────────────────────

  @Post(':id/entries')
  addEntry(@Param('id') id: string, @Body() dto: { key: string; value: Record<string, unknown> }) {
    return this.svc.addEntry(id, dto);
  }

  @Delete('entries/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntry(@Param('entryId') entryId: string) {
    await this.svc.deleteEntry(entryId);
  }

  // ── Key lookup (used by EnrichHandler) ────────────────────────────────────

  @Get(':id/lookup/:key')
  lookup(@Param('id') id: string, @Param('key') key: string) {
    return this.svc.lookup(id, key);
  }

  /** Lookup by table name (within a product line) */
  @Get('by-name/:tableName/lookup/:key')
  lookupByName(
    @Param('tableName') tableName: string,
    @Param('key') key: string,
    @Query('productLineCode') productLineCode: string,
  ) {
    return this.svc.lookupByName(tableName, productLineCode, key);
  }
}
