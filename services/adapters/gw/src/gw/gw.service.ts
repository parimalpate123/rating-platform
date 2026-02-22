import { Injectable, Logger, NotFoundException } from '@nestjs/common';

export interface GwCallback {
  callbackId: string;
  correlationId?: string;
  policyNumber?: string;
  productLineCode?: string;
  transactionType?: string;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  initiatedAt: string;
  completedAt?: string;
  result?: unknown;
}

@Injectable()
export class GwService {
  private readonly logger = new Logger(GwService.name);
  private readonly callbacks: GwCallback[] = [];

  initiate(body: {
    correlationId?: string;
    policyNumber?: string;
    productLineCode?: string;
    transactionType?: string;
  }): { callbackId: string; status: string; message: string; initiatedAt: string } {
    const callbackId = `GW-CB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const cb: GwCallback = {
      callbackId,
      correlationId: body.correlationId,
      policyNumber: body.policyNumber || `POL-${Date.now()}`,
      productLineCode: body.productLineCode,
      transactionType: body.transactionType || 'new_business',
      status: 'INITIATED',
      initiatedAt: new Date().toISOString(),
    };
    this.callbacks.push(cb);
    this.logger.log(`GW rating initiated: callbackId=${callbackId}`);
    return { callbackId, status: 'INITIATED', message: 'Rating session initiated', initiatedAt: cb.initiatedAt };
  }

  complete(body: { callbackId: string; result?: unknown; status?: 'COMPLETED' | 'FAILED' }): GwCallback {
    const cb = this.callbacks.find((c) => c.callbackId === body.callbackId);
    if (!cb) throw new NotFoundException(`Callback ${body.callbackId} not found`);
    cb.status = body.status ?? 'COMPLETED';
    cb.completedAt = new Date().toISOString();
    cb.result = body.result;
    this.logger.log(`GW rating completed: callbackId=${body.callbackId} status=${cb.status}`);
    return cb;
  }

  list(limit = 50): GwCallback[] {
    return this.callbacks.slice(-limit).reverse();
  }

  get(callbackId: string): GwCallback {
    const cb = this.callbacks.find((c) => c.callbackId === callbackId);
    if (!cb) throw new NotFoundException(`Callback ${callbackId} not found`);
    return cb;
  }
}
