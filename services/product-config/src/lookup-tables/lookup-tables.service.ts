import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LookupTableEntity } from '../entities/lookup-table.entity';
import { LookupEntryEntity } from '../entities/lookup-entry.entity';

@Injectable()
export class LookupTablesService {
  constructor(
    @InjectRepository(LookupTableEntity)
    private readonly tables: Repository<LookupTableEntity>,
    @InjectRepository(LookupEntryEntity)
    private readonly entries: Repository<LookupEntryEntity>,
  ) {}

  findAll(productLineCode?: string): Promise<LookupTableEntity[]> {
    const where = productLineCode ? { productLineCode } : {};
    return this.tables.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<LookupTableEntity> {
    const t = await this.tables.findOne({ where: { id } });
    if (!t) throw new NotFoundException(`Lookup table '${id}' not found`);
    return t;
  }

  async create(dto: { name: string; productLineCode?: string; description?: string }): Promise<LookupTableEntity> {
    const entity = this.tables.create(dto);
    return this.tables.save(entity);
  }

  async update(id: string, dto: { name?: string; description?: string }): Promise<LookupTableEntity> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.tables.save(entity);
  }

  async delete(id: string): Promise<void> {
    await this.findOne(id);
    await this.tables.delete(id);
  }

  // ── Entries ──────────────────────────────────────────────────────────────────

  async addEntry(tableId: string, dto: { key: string; value: Record<string, unknown> }): Promise<LookupEntryEntity> {
    await this.findOne(tableId);
    const entry = this.entries.create({ lookupTableId: tableId, ...dto });
    return this.entries.save(entry);
  }

  async deleteEntry(entryId: string): Promise<void> {
    await this.entries.delete(entryId);
  }

  /** Key-based lookup — used by EnrichHandler */
  async lookup(tableId: string, key: string): Promise<{ found: boolean; key: string; value?: Record<string, unknown> }> {
    const entry = await this.entries.findOne({ where: { lookupTableId: tableId, key } });
    if (!entry) return { found: false, key };
    return { found: true, key, value: entry.value };
  }

  /** Lookup by table name + key — convenient for orchestrator steps */
  async lookupByName(
    tableName: string,
    productLineCode: string,
    key: string,
  ): Promise<{ found: boolean; key: string; value?: Record<string, unknown> }> {
    const table = await this.tables.findOne({ where: { name: tableName, productLineCode } });
    if (!table) return { found: false, key };
    return this.lookup(table.id, key);
  }
}
