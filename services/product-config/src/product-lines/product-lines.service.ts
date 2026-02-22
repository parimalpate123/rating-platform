import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductLineEntity } from '../entities/product-line.entity';
import { ActivityLogService } from '../activity-log/activity-log.service';

export interface CreateProductLineDto {
  code: string;
  name: string;
  description?: string;
  status?: string;
  productOwner?: string;
  technicalLead?: string;
  config?: Record<string, unknown>;
}

export interface UpdateProductLineDto {
  name?: string;
  description?: string;
  status?: string;
  productOwner?: string;
  technicalLead?: string;
  config?: Record<string, unknown>;
}

@Injectable()
export class ProductLinesService {
  constructor(
    @InjectRepository(ProductLineEntity)
    private readonly repo: Repository<ProductLineEntity>,
    private readonly activityLog: ActivityLogService,
  ) {}

  async findAll(): Promise<ProductLineEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCode(code: string): Promise<ProductLineEntity> {
    const entity = await this.repo.findOne({ where: { code } });
    if (!entity) throw new NotFoundException(`Product line '${code}' not found`);
    return entity;
  }

  async create(data: Partial<ProductLineEntity>): Promise<ProductLineEntity> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    await this.activityLog.log({
      productLineCode: saved.code,
      entityType: 'product_line',
      entityId: saved.id,
      action: 'created',
      details: { name: saved.name, status: saved.status },
    });
    return saved;
  }

  async update(code: string, data: Partial<ProductLineEntity>): Promise<ProductLineEntity> {
    const entity = await this.findByCode(code);
    const changes: Record<string, unknown> = {};
    for (const key of Object.keys(data) as (keyof typeof data)[]) {
      if (data[key] !== undefined && data[key] !== entity[key as keyof ProductLineEntity]) {
        changes[key] = data[key];
      }
    }
    Object.assign(entity, data);
    const saved = await this.repo.save(entity);
    if (Object.keys(changes).length > 0) {
      await this.activityLog.log({
        productLineCode: code,
        entityType: 'product_line',
        entityId: saved.id,
        action: 'updated',
        details: { changes },
      });
    }
    return saved;
  }

  async delete(code: string): Promise<void> {
    const entity = await this.findByCode(code);
    await this.activityLog.log({
      productLineCode: code,
      entityType: 'product_line',
      entityId: entity.id,
      action: 'deleted',
      details: { name: entity.name },
    });
    await this.repo.remove(entity);
  }
}
