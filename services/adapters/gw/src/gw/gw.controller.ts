import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { GwService } from './gw.service';

@Controller()
export class GwController {
  constructor(private readonly gw: GwService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'gw-adapter' };
  }

  @Post('rate/initiate')
  initiate(@Body() body: any) {
    return this.gw.initiate(body);
  }

  @Post('rate/complete')
  complete(@Body() body: { callbackId: string; result?: unknown; status?: 'COMPLETED' | 'FAILED' }) {
    return this.gw.complete(body);
  }

  @Get('callbacks')
  list(@Query('limit') limit?: string) {
    return this.gw.list(limit ? parseInt(limit, 10) : 50);
  }

  @Get('callbacks/:callbackId')
  get(@Param('callbackId') callbackId: string) {
    return this.gw.get(callbackId);
  }
}
