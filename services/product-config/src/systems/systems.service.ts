import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemEntity } from '../entities/system.entity';

export interface CreateSystemDto {
  code: string;
  name: string;
  type: 'source' | 'target' | 'both';
  format: 'json' | 'xml';
  protocol?: string;
  baseUrl?: string;
  isMock?: boolean;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateSystemDto {
  name?: string;
  type?: 'source' | 'target' | 'both';
  format?: 'json' | 'xml';
  protocol?: string;
  baseUrl?: string;
  isMock?: boolean;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

@Injectable()
export class SystemsService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemEntity)
    private readonly repo: Repository<SystemEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save([
        { code: 'gw-policycenter', name: 'Guidewire PolicyCenter', type: 'source', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3020', isMock: true, isActive: true },
        { code: 'cgi-ratabase', name: 'CGI Ratabase', type: 'target', format: 'xml', protocol: 'rest', baseUrl: 'http://localhost:3021', isMock: true, isActive: true },
        { code: 'earnix', name: 'Earnix Rating Engine', type: 'target', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3022', isMock: true, isActive: true },
        { code: 'dnb-service', name: 'Dun & Bradstreet', type: 'both', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3023', isMock: true, isActive: true },
        { code: 'kafka-mock', name: 'Kafka (Mock)', type: 'target', format: 'json', protocol: 'mock', baseUrl: 'http://localhost:3024', isMock: true, isActive: true },
      ]);
    }
  }

  async findAll(): Promise<SystemEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<SystemEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`System with id "${id}" not found`);
    return entity;
  }

  async create(data: Partial<SystemEntity>): Promise<SystemEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<SystemEntity>): Promise<SystemEntity> {
    const entity = await this.findById(id);
    Object.assign(entity, data);
    return this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    const entity = await this.findById(id);
    await this.repo.remove(entity);
  }

  async healthCheck(id: string): Promise<{ systemId: string; status: string; system: string; timestamp: string }> {
    const entity = await this.findById(id);
    return {
      systemId: entity.id,
      status: entity.isMock ? 'mock-healthy' : 'unknown',
      system: entity.name,
      timestamp: new Date().toISOString(),
    };
  }
}
