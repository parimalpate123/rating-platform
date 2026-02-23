import { Controller, Get } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return this.appService.getHealth();
  }

  @Get('db-health')
  async dbHealth() {
    const result = await this.appService.getDbHealth();
    if (result.db !== 'connected') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
