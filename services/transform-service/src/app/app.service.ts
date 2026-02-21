import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'transform-service',
      timestamp: new Date().toISOString(),
    };
  }
}
