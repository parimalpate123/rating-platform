import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'product-config',
      timestamp: new Date().toISOString(),
    };
  }

  /** DB connectivity check for platform health dashboard. */
  async getDbHealth(): Promise<{ status: string; db: string; timestamp: string }> {
    const timestamp = new Date().toISOString();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', db: 'connected', timestamp };
    } catch {
      return { status: 'error', db: 'disconnected', timestamp };
    }
  }
}
