import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ProductOrchestratorEntity } from '../entities/product-orchestrator.entity';
import { OrchestratorStepEntity } from '../entities/orchestrator-step.entity';

const XML_TARGET_STEPS = [
  { order: 1, type: 'field_mapping', name: 'Map Request Fields', config: { direction: 'request' } },
  { order: 2, type: 'apply_rules', name: 'Pre-Rating Rules', config: { scope: 'pre_rating' } },
  { order: 3, type: 'format_transform', name: 'JSON to XML', config: { formatDirection: 'json_to_xml' } },
  { order: 4, type: 'call_rating_engine', name: 'Call CGI Ratabase', config: { systemCode: 'cgi-ratabase' } },
  { order: 5, type: 'format_transform', name: 'XML to JSON', config: { formatDirection: 'xml_to_json' } },
  { order: 6, type: 'field_mapping', name: 'Map Response Fields', config: { direction: 'response' } },
  { order: 7, type: 'apply_rules', name: 'Post-Rating Rules', config: { scope: 'post_rating' } },
  { order: 8, type: 'publish_event', name: 'Publish Rating Event', config: { topic: 'rating.completed' } },
];

const JSON_TARGET_STEPS = [
  { order: 1, type: 'field_mapping', name: 'Map Request Fields', config: { direction: 'request' } },
  { order: 2, type: 'apply_rules', name: 'Pre-Rating Rules', config: { scope: 'pre_rating' } },
  { order: 3, type: 'call_rating_engine', name: 'Call Earnix', config: { systemCode: 'earnix' } },
  { order: 4, type: 'field_mapping', name: 'Map Response Fields', config: { direction: 'response' } },
  { order: 5, type: 'apply_rules', name: 'Post-Rating Rules', config: { scope: 'post_rating' } },
];

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    @InjectRepository(ProductOrchestratorEntity)
    private orchRepo: Repository<ProductOrchestratorEntity>,
    @InjectRepository(OrchestratorStepEntity)
    private stepRepo: Repository<OrchestratorStepEntity>,
  ) {}

  async findAllByProduct(productLineCode: string): Promise<any[]> {
    const orchs = await this.orchRepo.find({
      where: { productLineCode },
      order: { createdAt: 'ASC' },
    });
    const results: any[] = [];
    for (const orch of orchs) {
      const steps = await this.stepRepo.find({
        where: { orchestratorId: orch.id },
        order: { stepOrder: 'ASC' },
      });
      results.push({ ...orch, steps });
    }
    return results;
  }

  async findByProductAndEndpoint(
    productLineCode: string,
    endpointPath: string,
  ): Promise<any | null> {
    const orch = await this.orchRepo.findOne({
      where: { productLineCode, endpointPath },
    });
    if (!orch) return null;
    const steps = await this.stepRepo.find({
      where: { orchestratorId: orch.id },
      order: { stepOrder: 'ASC' },
    });
    return { ...orch, steps };
  }

  // Backward-compatible: returns first flow (defaults to 'rate')
  async findByProduct(productLineCode: string): Promise<any | null> {
    return this.findByProductAndEndpoint(productLineCode, 'rate');
  }

  async create(
    productLineCode: string,
    name: string,
    endpointPath = 'rate',
  ): Promise<ProductOrchestratorEntity> {
    const orch = this.orchRepo.create({
      productLineCode,
      name,
      endpointPath,
      status: 'draft',
    });
    return this.orchRepo.save(orch);
  }

  async getSteps(orchestratorId: string): Promise<OrchestratorStepEntity[]> {
    return this.stepRepo.find({
      where: { orchestratorId },
      order: { stepOrder: 'ASC' },
    });
  }

  async addStep(
    orchestratorId: string,
    data: {
      stepType: string;
      name: string;
      config: Record<string, unknown>;
      stepOrder?: number;
    },
  ): Promise<OrchestratorStepEntity> {
    const step = this.stepRepo.create({
      orchestratorId,
      stepType: data.stepType,
      name: data.name,
      config: data.config || {},
      stepOrder: data.stepOrder ?? 0,
      isActive: true,
    });
    return this.stepRepo.save(step);
  }

  async updateStep(
    stepId: string,
    data: Partial<Pick<OrchestratorStepEntity, 'name' | 'config' | 'isActive' | 'stepOrder' | 'stepType'>>,
  ): Promise<OrchestratorStepEntity> {
    const step = await this.stepRepo.findOne({ where: { id: stepId } });
    if (!step) {
      throw new NotFoundException(`Step ${stepId} not found`);
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

  async deleteOrchestrator(
    productLineCode: string,
    endpointPath?: string,
  ): Promise<void> {
    if (endpointPath) {
      const existing = await this.orchRepo.findOne({
        where: { productLineCode, endpointPath },
      });
      if (!existing) {
        throw new NotFoundException(
          `Orchestrator not found for product: ${productLineCode}, endpoint: ${endpointPath}`,
        );
      }
      await this.stepRepo.delete({ orchestratorId: existing.id });
      await this.orchRepo.remove(existing);
    } else {
      const orchs = await this.orchRepo.find({ where: { productLineCode } });
      if (orchs.length === 0) {
        throw new NotFoundException(`Orchestrator not found for product: ${productLineCode}`);
      }
      for (const orch of orchs) {
        await this.stepRepo.delete({ orchestratorId: orch.id });
        await this.orchRepo.remove(orch);
      }
    }
  }

  async reorderSteps(
    orchestratorId: string,
    stepIds: string[],
  ): Promise<void> {
    for (let i = 0; i < stepIds.length; i++) {
      await this.stepRepo.update({ id: stepIds[i] }, { stepOrder: i });
    }
  }

  async autoGenerate(
    productLineCode: string,
    targetFormat: 'xml' | 'json',
    endpointPath = 'rate',
  ): Promise<any> {
    const productConfigUrl =
      process.env['PRODUCT_CONFIG_URL'] || 'http://localhost:4010';

    // Delete existing orchestrator for this product + endpoint if present
    const existing = await this.orchRepo.findOne({
      where: { productLineCode, endpointPath },
    });
    if (existing) {
      await this.stepRepo.delete({ orchestratorId: existing.id });
      await this.orchRepo.remove(existing);
    }

    const orch = await this.create(
      productLineCode,
      `${productLineCode} ${endpointPath === 'rate' ? 'Rating' : endpointPath} Flow`,
      endpointPath,
    );

    const template = targetFormat === 'xml' ? XML_TARGET_STEPS : JSON_TARGET_STEPS;

    const steps: OrchestratorStepEntity[] = [];
    for (const t of template) {
      const config: Record<string, unknown> = { ...(t.config as Record<string, unknown>) };

      if (t.type === 'field_mapping') {
        const direction = (config.direction as string) ?? 'request';
        try {
          const { data: mapping } = await axios.post(
            `${productConfigUrl}/api/v1/mappings`,
            {
              name: `${productLineCode} — ${t.name}`,
              productLineCode,
              direction,
              status: 'draft',
            },
          );
          config.mappingId = mapping.id;
          this.logger.log(
            `Created mapping stub ${mapping.id} for step "${t.name}" (${direction})`,
          );
        } catch (err) {
          this.logger.warn(
            `Could not create mapping stub for step "${t.name}": ${err}`,
          );
        }
      }

      const step = await this.addStep(orch.id, {
        stepType: t.type,
        name: t.name,
        config,
        stepOrder: t.order,
      });
      steps.push(step);
    }

    this.logger.log(
      `Auto-generated ${targetFormat.toUpperCase()} orchestrator for ${productLineCode}/${endpointPath} with ${steps.length} steps`,
    );

    return { ...orch, steps };
  }
}
