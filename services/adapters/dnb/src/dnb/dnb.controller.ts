import { Controller, Post, Get, Body } from '@nestjs/common';
import { DnbService } from './dnb.service';

@Controller()
export class DnbController {
  constructor(private readonly dnb: DnbService) {}

  @Get('health')
  health() {
    return { status: 'ok', service: 'dnb-adapter' };
  }

  @Post('lookup')
  lookup(@Body() body: { taxId?: string; companyName?: string }) {
    return this.dnb.lookup(body.taxId, body.companyName);
  }

  @Get('companies')
  list() {
    return this.dnb.list();
  }
}
