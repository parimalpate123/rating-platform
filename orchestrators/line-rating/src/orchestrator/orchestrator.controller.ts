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

  @Get(':productLineCode')
  async getByProductCode(@Param('productLineCode') code: string) {
    const result = await this.orchestratorService.findByProduct(code);
    if (!result) {
      throw new NotFoundException(`Orchestrator not found for product: ${code}`);
    }
    return result;
  }

  @Delete(':productLineCode')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOrchestrator(@Param('productLineCode') code: string) {
    return this.orchestratorService.deleteOrchestrator(code);
  }

  @Post(':productLineCode/auto-generate')
  autoGenerate(
    @Param('productLineCode') code: string,
    @Body() body: { targetFormat: 'xml' | 'json' },
  ) {
    return this.orchestratorService.autoGenerate(code, body.targetFormat);
  }

  @Get(':productLineCode/steps')
  async getSteps(@Param('productLineCode') code: string) {
    const orch = await this.orchestratorService.findByProduct(code);
    if (!orch) {
      throw new NotFoundException(`Orchestrator not found for product: ${code}`);
    }
    return this.orchestratorService.getSteps(orch.id);
  }

  @Post(':productLineCode/steps')
  async addStep(
    @Param('productLineCode') code: string,
    @Body()
    body: {
      stepType: string;
      name: string;
      config: Record<string, unknown>;
      stepOrder?: number;
    },
  ) {
    const orch = await this.orchestratorService.findByProduct(code);
    if (!orch) {
      throw new NotFoundException(`Orchestrator not found for product: ${code}`);
    }
    return this.orchestratorService.addStep(orch.id, body);
  }

  @Put(':productLineCode/steps/:stepId')
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

  @Delete(':productLineCode/steps/:stepId')
  deleteStep(@Param('stepId') stepId: string) {
    return this.orchestratorService.deleteStep(stepId);
  }

  @Post(':productLineCode/steps/reorder')
  async reorderSteps(
    @Param('productLineCode') code: string,
    @Body() body: { stepIds: string[] },
  ) {
    const orch = await this.orchestratorService.findByProduct(code);
    if (!orch) {
      throw new NotFoundException(`Orchestrator not found for product: ${code}`);
    }
    await this.orchestratorService.reorderSteps(orch.id, body.stepIds);
    return { success: true };
  }
}
