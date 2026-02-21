import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'line-rating',
      timestamp: new Date().toISOString(),
    };
  }
}
