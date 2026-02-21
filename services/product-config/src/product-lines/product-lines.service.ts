import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductLineEntity } from '../entities/product-line.entity';

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
    return this.repo.save(entity);
  }

  async update(code: string, data: Partial<ProductLineEntity>): Promise<ProductLineEntity> {
    const entity = await this.findByCode(code);
    Object.assign(entity, data);
    return this.repo.save(entity);
  }

  async delete(code: string): Promise<void> {
    const entity = await this.findByCode(code);
    await this.repo.remove(entity);
  }
}
