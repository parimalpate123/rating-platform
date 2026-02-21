import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'core-rating',
      timestamp: new Date().toISOString(),
    };
  }
}
