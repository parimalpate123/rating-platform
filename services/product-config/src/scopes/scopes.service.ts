import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductScopeEntity } from '../entities/product-scope.entity';

export interface CreateScopeDto {
  scopeType: string;
  scopeValue: string;
  isActive?: boolean;
}

export interface UpdateScopeDto {
  scopeType?: string;
  scopeValue?: string;
  isActive?: boolean;
}

@Injectable()
export class ScopesService {
  constructor(
    @InjectRepository(ProductScopeEntity)
    private readonly repo: Repository<ProductScopeEntity>,
  ) {}

  async findByProductLine(productLineCode: string): Promise<ProductScopeEntity[]> {
    return this.repo.find({
      where: { productLineCode },
      order: { createdAt: 'ASC' },
    });
  }

  async create(productLineCode: string, data: Partial<ProductScopeEntity>): Promise<ProductScopeEntity> {
    const entity = this.repo.create({ ...data, productLineCode });
    return this.repo.save(entity);
  }

  async update(productLineCode: string, id: string, data: Partial<ProductScopeEntity>): Promise<ProductScopeEntity> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing || existing.productLineCode !== productLineCode) {
      throw new NotFoundException(`Scope "${id}" not found for product line "${productLineCode}"`);
    }
    Object.assign(existing, data);
    return this.repo.save(existing);
  }

  async delete(productLineCode: string, id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing || existing.productLineCode !== productLineCode) {
      throw new NotFoundException(`Scope "${id}" not found for product line "${productLineCode}"`);
    }
    await this.repo.remove(existing);
  }
}
