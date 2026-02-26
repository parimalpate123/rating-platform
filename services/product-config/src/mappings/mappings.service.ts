import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MappingEntity } from '../entities/mapping.entity';
import { FieldMappingEntity } from '../entities/field-mapping.entity';
import { ScopeTagEntity } from '../entities/scope-tag.entity';

export interface CreateMappingDto {
  name: string;
  productLineCode?: string;
  direction?: string;
  status?: string;
  createdBy?: string;
}

export interface UpdateMappingDto {
  name?: string;
  productLineCode?: string;
  direction?: string;
  status?: string;
}

export interface CreateFieldMappingDto {
  sourcePath: string;
  targetPath: string;
  transformationType?: string;
  transformConfig?: Record<string, unknown>;
  isRequired?: boolean;
  defaultValue?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateFieldMappingDto {
  sourcePath?: string;
  targetPath?: string;
  transformationType?: string;
  transformConfig?: Record<string, unknown>;
  isRequired?: boolean;
  defaultValue?: string;
  description?: string;
  sortOrder?: number;
}

@Injectable()
export class MappingsService {
  constructor(
    @InjectRepository(MappingEntity)
    private readonly mappingRepo: Repository<MappingEntity>,
    @InjectRepository(FieldMappingEntity)
    private readonly fieldMappingRepo: Repository<FieldMappingEntity>,
    @InjectRepository(ScopeTagEntity)
    private readonly scopeTagRepo: Repository<ScopeTagEntity>,
  ) {}

  // --- Mappings ---

  async findAllMappings(productLineCode?: string): Promise<MappingEntity[]> {
    const where = productLineCode ? { productLineCode } : {};
    return this.mappingRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findMappingById(id: string): Promise<MappingEntity> {
    const entity = await this.mappingRepo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`Mapping with id "${id}" not found`);
    return entity;
  }

  async createMapping(data: Partial<MappingEntity>): Promise<MappingEntity> {
    const entity = this.mappingRepo.create(data);
    return this.mappingRepo.save(entity);
  }

  async updateMapping(id: string, data: Partial<MappingEntity>): Promise<MappingEntity> {
    const entity = await this.findMappingById(id);
    Object.assign(entity, data);
    return this.mappingRepo.save(entity);
  }

  async deleteMapping(id: string): Promise<void> {
    const entity = await this.findMappingById(id);
    await this.fieldMappingRepo.delete({ mappingId: id });
    await this.mappingRepo.remove(entity);
  }

  // --- Field Mappings ---

  async findFieldsByMappingId(mappingId: string): Promise<FieldMappingEntity[]> {
    await this.findMappingById(mappingId); // ensure parent exists
    return this.fieldMappingRepo.find({
      where: { mappingId },
      order: { sortOrder: 'ASC' },
    });
  }

  async createFieldMapping(mappingId: string, data: Partial<FieldMappingEntity>): Promise<FieldMappingEntity> {
    await this.findMappingById(mappingId); // ensure parent exists
    const entity = this.fieldMappingRepo.create({ ...data, mappingId });
    return this.fieldMappingRepo.save(entity);
  }

  async updateFieldMapping(mappingId: string, fieldId: string, data: Partial<FieldMappingEntity>): Promise<FieldMappingEntity> {
    const existing = await this.fieldMappingRepo.findOne({ where: { id: fieldId } });
    if (!existing || existing.mappingId !== mappingId) {
      throw new NotFoundException(`Field mapping "${fieldId}" not found in mapping "${mappingId}"`);
    }
    Object.assign(existing, data);
    return this.fieldMappingRepo.save(existing);
  }

  async deleteFieldMapping(mappingId: string, fieldId: string): Promise<void> {
    const existing = await this.fieldMappingRepo.findOne({ where: { id: fieldId } });
    if (!existing || existing.mappingId !== mappingId) {
      throw new NotFoundException(`Field mapping "${fieldId}" not found in mapping "${mappingId}"`);
    }
    await this.fieldMappingRepo.remove(existing);
  }

  // --- Activation ---

  async activateMapping(id: string): Promise<MappingEntity> {
    const entity = await this.findMappingById(id);
    entity.status = 'active';
    return this.mappingRepo.save(entity);
  }

  // --- Scope Tags ---

  async listScopeTags(mappingId: string): Promise<ScopeTagEntity[]> {
    await this.findMappingById(mappingId);
    return this.scopeTagRepo.find({ where: { entityType: 'mapping', entityId: mappingId } });
  }

  async addScopeTag(mappingId: string, scopeType: string, scopeValue: string): Promise<ScopeTagEntity> {
    await this.findMappingById(mappingId);
    const tag = this.scopeTagRepo.create({ entityType: 'mapping', entityId: mappingId, scopeType, scopeValue });
    return this.scopeTagRepo.save(tag);
  }

  async deleteScopeTag(mappingId: string, tagId: string): Promise<void> {
    await this.scopeTagRepo.delete({ id: tagId, entityType: 'mapping', entityId: mappingId });
  }

  // --- Clone ---

  async cloneMapping(id: string, name?: string, productLineCode?: string): Promise<MappingEntity> {
    const source = await this.findMappingById(id);
    const fields = await this.findFieldsByMappingId(id);

    const clone = this.mappingRepo.create({
      name: name ?? `${source.name} (copy)`,
      productLineCode: productLineCode ?? source.productLineCode,
      direction: source.direction,
      status: 'draft',
    });
    const saved = await this.mappingRepo.save(clone);

    if (fields.length > 0) {
      const clonedFields = fields.map((f) =>
        this.fieldMappingRepo.create({
          mappingId: saved.id,
          sourcePath: f.sourcePath,
          targetPath: f.targetPath,
          transformationType: f.transformationType,
          transformConfig: f.transformConfig,
          isRequired: f.isRequired,
          defaultValue: f.defaultValue,
          description: f.description,
          sortOrder: f.sortOrder,
        }),
      );
      await this.fieldMappingRepo.save(clonedFields);
    }
    return saved;
  }
}
