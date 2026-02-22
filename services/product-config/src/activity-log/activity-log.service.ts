import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLogEntity } from '../entities/activity-log.entity';

export interface LogActivityDto {
  productLineCode: string;
  entityType: string;
  entityId?: string;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly repo: Repository<ActivityLogEntity>,
  ) {}

  async log(dto: LogActivityDto): Promise<void> {
    const entry = this.repo.create({
      productLineCode: dto.productLineCode,
      entityType: dto.entityType,
      entityId: dto.entityId ?? null,
      action: dto.action,
      actor: dto.actor ?? 'system',
      details: dto.details ?? {},
    });
    await this.repo.save(entry).catch(() => {
      // Non-critical — never let activity logging break a request
    });
  }

  async findByProduct(
    productLineCode: string,
    limit = 50,
  ): Promise<ActivityLogEntity[]> {
    return this.repo.find({
      where: { productLineCode },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
