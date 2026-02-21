import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'status-service',
      timestamp: new Date().toISOString(),
    };
  }
}
