import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomFlowsService } from './custom-flows.service';

@Controller('custom-flows')
export class CustomFlowsController {
  constructor(private readonly customFlowsService: CustomFlowsService) {}

  @Get()
  async list(@Query('productLineCode') productLineCode?: string) {
    return this.customFlowsService.findAll(productLineCode);
  }

  @Get(':id/steps')
  async getSteps(@Param('id') id: string) {
    return this.customFlowsService.getSteps(id);
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.customFlowsService.findOne(id);
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      description?: string | null;
      scope: 'universal' | 'product';
      productLineCode?: string | null;
    },
  ) {
    return this.customFlowsService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      description: string | null;
      scope: 'universal' | 'product';
      productLineCode: string | null;
    }>,
  ) {
    return this.customFlowsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    return this.customFlowsService.delete(id);
  }

  @Post(':id/steps')
  async addStep(
    @Param('id') id: string,
    @Body()
    body: {
      stepType: string;
      name: string;
      config?: Record<string, unknown>;
      stepOrder?: number;
    },
  ) {
    return this.customFlowsService.addStep(id, body);
  }

  @Put('steps/:stepId')
  async updateStep(
    @Param('stepId') stepId: string,
    @Body()
    body: Partial<{
      name: string;
      config: Record<string, unknown>;
      isActive: boolean;
      stepOrder: number;
      stepType: string;
    }>,
  ) {
    return this.customFlowsService.updateStep(stepId, body);
  }

  @Delete('steps/:stepId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStep(@Param('stepId') stepId: string) {
    return this.customFlowsService.deleteStep(stepId);
  }

  @Post(':id/steps/reorder')
  async reorderSteps(
    @Param('id') id: string,
    @Body() body: { stepIds: string[] },
  ) {
    await this.customFlowsService.reorderSteps(id, body.stepIds ?? []);
    return { success: true };
  }
}
