import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomFlowEntity } from '../entities/custom-flow.entity';
import { CustomFlowStepEntity } from '../entities/custom-flow-step.entity';

const ALLOWED_CUSTOM_FLOW_STEP_TYPES = [
  'validate_request',
  'generate_value',
  'field_mapping',
  'enrich',
  'publish_event',
  'run_script',
];

@Injectable()
export class CustomFlowsService {
  constructor(
    @InjectRepository(CustomFlowEntity)
    private readonly flowRepo: Repository<CustomFlowEntity>,
    @InjectRepository(CustomFlowStepEntity)
    private readonly stepRepo: Repository<CustomFlowStepEntity>,
  ) {}

  async findAll(productLineCode?: string): Promise<(CustomFlowEntity & { steps: CustomFlowStepEntity[] })[]> {
    let flows: CustomFlowEntity[];
    if (productLineCode != null && productLineCode !== '') {
      flows = await this.flowRepo
        .createQueryBuilder('f')
        .where('f.scope = :scope', { scope: 'universal' })
        .orWhere('(f.scope = :productScope AND f.product_line_code = :code)', {
          productScope: 'product',
          code: productLineCode,
        })
        .orderBy('f.created_at', 'ASC')
        .getMany();
    } else {
      flows = await this.flowRepo.find({ order: { createdAt: 'ASC' } });
    }

    const results: (CustomFlowEntity & { steps: CustomFlowStepEntity[] })[] = [];
    for (const flow of flows) {
      const steps = await this.stepRepo.find({
        where: { customFlowId: flow.id },
        order: { stepOrder: 'ASC' },
      });
      results.push({ ...flow, steps });
    }
    return results;
  }

  async findOne(id: string): Promise<CustomFlowEntity & { steps: CustomFlowStepEntity[] }> {
    const flow = await this.flowRepo.findOne({ where: { id } });
    if (!flow) {
      throw new NotFoundException(`Custom flow ${id} not found`);
    }
    const steps = await this.stepRepo.find({
      where: { customFlowId: flow.id },
      order: { stepOrder: 'ASC' },
    });
    return { ...flow, steps };
  }

  async create(data: {
    name: string;
    description?: string | null;
    scope: 'universal' | 'product';
    productLineCode?: string | null;
  }): Promise<CustomFlowEntity> {
    if (data.scope === 'product' && (data.productLineCode == null || data.productLineCode === '')) {
      throw new BadRequestException('productLineCode is required when scope is product');
    }
    if (data.scope === 'universal') {
      data = { ...data, productLineCode: null };
    }
    const flow = this.flowRepo.create({
      name: data.name,
      description: data.description ?? null,
      scope: data.scope,
      productLineCode: data.productLineCode ?? null,
    });
    return this.flowRepo.save(flow);
  }

  async update(
    id: string,
    data: Partial<Pick<CustomFlowEntity, 'name' | 'description' | 'scope' | 'productLineCode'>>,
  ): Promise<CustomFlowEntity> {
    const flow = await this.flowRepo.findOne({ where: { id } });
    if (!flow) {
      throw new NotFoundException(`Custom flow ${id} not found`);
    }
    if (data.scope === 'product' && (data.productLineCode == null || data.productLineCode === '')) {
      throw new BadRequestException('productLineCode is required when scope is product');
    }
    if (data.scope === 'universal') {
      data.productLineCode = null;
    }
    Object.assign(flow, data);
    return this.flowRepo.save(flow);
  }

  async delete(id: string): Promise<void> {
    const flow = await this.flowRepo.findOne({ where: { id } });
    if (!flow) {
      throw new NotFoundException(`Custom flow ${id} not found`);
    }
    await this.stepRepo.delete({ customFlowId: id });
    await this.flowRepo.remove(flow);
  }

  async getSteps(customFlowId: string): Promise<CustomFlowStepEntity[]> {
    await this.findOne(customFlowId);
    return this.stepRepo.find({
      where: { customFlowId },
      order: { stepOrder: 'ASC' },
    });
  }

  async addStep(
    customFlowId: string,
    data: {
      stepType: string;
      name: string;
      config: Record<string, unknown>;
      stepOrder?: number;
    },
  ): Promise<CustomFlowStepEntity> {
    if (!ALLOWED_CUSTOM_FLOW_STEP_TYPES.includes(data.stepType)) {
      throw new BadRequestException(
        `Step type must be one of: ${ALLOWED_CUSTOM_FLOW_STEP_TYPES.join(', ')}`,
      );
    }
    await this.findOne(customFlowId);
    const maxOrder = await this.stepRepo
      .createQueryBuilder('s')
      .where('s.custom_flow_id = :id', { id: customFlowId })
      .select('MAX(s.step_order)', 'max')
      .getRawOne();
    const step = this.stepRepo.create({
      customFlowId,
      stepType: data.stepType,
      name: data.name,
      config: data.config ?? {},
      stepOrder: data.stepOrder ?? (maxOrder?.max ?? 0) + 1,
      isActive: true,
    });
    return this.stepRepo.save(step);
  }

  async updateStep(
    stepId: string,
    data: Partial<Pick<CustomFlowStepEntity, 'name' | 'config' | 'isActive' | 'stepOrder' | 'stepType'>>,
  ): Promise<CustomFlowStepEntity> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }
    if (data.stepType != null && !ALLOWED_CUSTOM_FLOW_STEP_TYPES.includes(data.stepType)) {
      throw new BadRequestException(
        `Step type must be one of: ${ALLOWED_CUSTOM_FLOW_STEP_TYPES.join(', ')}`,
      );
    }
    Object.assign(step, data);
    return this.stepRepo.save(step);
  }

  async deleteStep(stepId: string): Promise<void> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }
    await this.stepRepo.remove(step);
  }

  async reorderSteps(customFlowId: string, stepIds: string[]): Promise<void> {
    await this.findOne(customFlowId);
    for (let i = 0; i < stepIds.length; i++) {
      await this.stepRepo.update({ id: stepIds[i], customFlowId }, { stepOrder: i });
    }
  }
}
