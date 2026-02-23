import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';

@Controller('orchestrators')
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'line-rating', timestamp: new Date().toISOString() };
  }

  // ── Multi-flow: list all flows for a product ────────────────────────────────
  @Get(':productLineCode')
  async getAllFlows(@Param('productLineCode') code: string) {
    return this.orchestratorService.findAllByProduct(code);
  }

  // ── Single flow by endpoint path ────────────────────────────────────────────
  @Get(':productLineCode/flow/:endpointPath')
  async getFlow(
    @Param('productLineCode') code: string,
    @Param('endpointPath') endpointPath: string,
  ) {
    const result = await this.orchestratorService.findByProductAndEndpoint(code, endpointPath);
    if (!result) {
      throw new NotFoundException(
        `Orchestrator not found for product: ${code}, endpoint: ${endpointPath}`,
      );
    }
    return result;
  }

  // ── Delete a specific flow ──────────────────────────────────────────────────
  @Delete(':productLineCode/flow/:endpointPath')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFlow(
    @Param('productLineCode') code: string,
    @Param('endpointPath') endpointPath: string,
  ) {
    return this.orchestratorService.deleteOrchestrator(code, endpointPath);
  }

  // ── Auto-generate a flow ────────────────────────────────────────────────────
  @Post(':productLineCode/auto-generate')
  autoGenerate(
    @Param('productLineCode') code: string,
    @Body() body: { targetFormat: 'xml' | 'json'; endpointPath?: string },
  ) {
    return this.orchestratorService.autoGenerate(
      code,
      body.targetFormat,
      body.endpointPath || 'rate',
    );
  }

  // ── Create empty flow ───────────────────────────────────────────────────────
  @Post(':productLineCode/flows')
  async createFlow(
    @Param('productLineCode') code: string,
    @Body() body: { name: string; endpointPath: string },
  ) {
    const orch = await this.orchestratorService.create(
      code,
      body.name,
      body.endpointPath,
    );
    return { ...orch, steps: [] };
  }

  // ── Steps CRUD (scoped by flow endpoint path) ──────────────────────────────

  @Get(':productLineCode/flow/:endpointPath/steps')
  async getSteps(
    @Param('productLineCode') code: string,
    @Param('endpointPath') endpointPath: string,
  ) {
    const orch = await this.orchestratorService.findByProductAndEndpoint(code, endpointPath);
    if (!orch) {
      throw new NotFoundException(
        `Orchestrator not found for product: ${code}, endpoint: ${endpointPath}`,
      );
    }
    return this.orchestratorService.getSteps(orch.id);
  }

  @Post(':productLineCode/flow/:endpointPath/steps')
  async addStep(
    @Param('productLineCode') code: string,
    @Param('endpointPath') endpointPath: string,
    @Body()
    body: {
      stepType: string;
      name: string;
      config: Record<string, unknown>;
      stepOrder?: number;
    },
  ) {
    const orch = await this.orchestratorService.findByProductAndEndpoint(code, endpointPath);
    if (!orch) {
      throw new NotFoundException(
        `Orchestrator not found for product: ${code}, endpoint: ${endpointPath}`,
      );
    }
    return this.orchestratorService.addStep(orch.id, body);
  }

  @Put(':productLineCode/flow/:endpointPath/steps/:stepId')
  updateStep(
    @Param('stepId') stepId: string,
    @Body()
    body: {
      name?: string;
      config?: Record<string, unknown>;
      isActive?: boolean;
      stepOrder?: number;
      stepType?: string;
    },
  ) {
    return this.orchestratorService.updateStep(stepId, body);
  }

  @Delete(':productLineCode/flow/:endpointPath/steps/:stepId')
  deleteStep(@Param('stepId') stepId: string) {
    return this.orchestratorService.deleteStep(stepId);
  }

  @Post(':productLineCode/flow/:endpointPath/steps/reorder')
  async reorderSteps(
    @Param('productLineCode') code: string,
    @Param('endpointPath') endpointPath: string,
    @Body() body: { stepIds: string[] },
  ) {
    const orch = await this.orchestratorService.findByProductAndEndpoint(code, endpointPath);
    if (!orch) {
      throw new NotFoundException(
        `Orchestrator not found for product: ${code}, endpoint: ${endpointPath}`,
      );
    }
    await this.orchestratorService.reorderSteps(orch.id, body.stepIds);
    return { success: true };
  }
}
