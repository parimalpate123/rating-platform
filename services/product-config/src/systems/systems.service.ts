import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemEntity } from '../entities/system.entity';

export interface CreateSystemDto {
  code: string;
  name: string;
  type: 'source' | 'target' | 'both';
  format: 'json' | 'xml';
  protocol?: string;
  baseUrl?: string;
  baseUrlProd?: string;
  authMethod?: 'none' | 'basic' | 'oauth2';
  isMock?: boolean;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface UpdateSystemDto {
  name?: string;
  type?: 'source' | 'target' | 'both';
  format?: 'json' | 'xml';
  protocol?: string;
  baseUrl?: string;
  baseUrlProd?: string;
  authMethod?: 'none' | 'basic' | 'oauth2';
  isMock?: boolean;
  isActive?: boolean;
  config?: Record<string, unknown>;
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;

function getEffectiveBaseUrl(entity: SystemEntity): string | null {
  const isProd = process.env.NODE_ENV === 'production';
  const url = isProd && entity.baseUrlProd ? entity.baseUrlProd : entity.baseUrl;
  return url || null;
}

/** URL to show in UI. In production, mock systems with no baseUrlProd show Core Rating URL or a label instead of localhost. */
function getDisplayUrl(entity: SystemEntity): string | null {
  const effective = getEffectiveBaseUrl(entity);
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && entity.isMock && (!effective || effective.includes('localhost'))) {
    return process.env.CORE_RATING_URL || '(Mock - routed via Core Rating)';
  }
  return effective;
}

/** Strip credentials from config.auth before sending to client */
function sanitizeConfig(config: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!config || !config.auth) return config ?? {};
  const auth = config.auth as Record<string, unknown>;
  const out: Record<string, unknown> = { ...auth };
  if ('password' in auth) out.password = '[REDACTED]';
  if ('clientSecret' in auth) out.clientSecret = '[REDACTED]';
  return { ...config, auth: out };
}

async function buildAuthHeaders(entity: SystemEntity): Promise<Record<string, string>> {
  const method = (entity.authMethod || 'none').toLowerCase();
  const auth = (entity.config?.auth as Record<string, string> | undefined) || {};
  if (method === 'basic' && auth.username && auth.password) {
    const encoded = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  if (method === 'oauth2' && auth.clientId && auth.clientSecret && auth.tokenUrl) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
    });
    const res = await fetch(auth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`OAuth2 token failed: ${res.status}`);
    const data = (await res.json()) as { access_token?: string };
    if (data.access_token) return { Authorization: `Bearer ${data.access_token}` };
  }
  return {};
}

@Injectable()
export class SystemsService implements OnModuleInit {
  constructor(
    @InjectRepository(SystemEntity)
    private readonly repo: Repository<SystemEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save([
        { code: 'gw-policycenter', name: 'Guidewire PolicyCenter', type: 'source', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3020', isMock: true, isActive: true },
        { code: 'cgi-ratabase', name: 'CGI Ratabase', type: 'target', format: 'xml', protocol: 'rest', baseUrl: 'http://localhost:3021', isMock: true, isActive: true },
        { code: 'earnix', name: 'Earnix Rating Engine', type: 'target', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3022', isMock: true, isActive: true },
        { code: 'dnb-service', name: 'Dun & Bradstreet', type: 'both', format: 'json', protocol: 'rest', baseUrl: 'http://localhost:3023', isMock: true, isActive: true },
        { code: 'kafka-mock', name: 'Kafka (Mock)', type: 'target', format: 'json', protocol: 'mock', baseUrl: 'http://localhost:3024', isMock: true, isActive: true },
      ]);
    }
  }

  async findAll(): Promise<(SystemEntity & { url?: string | null })[]> {
    const list = await this.repo.find({ order: { createdAt: 'DESC' } });
    return list.map((e) => ({
      ...e,
      config: sanitizeConfig(e.config),
      url: getDisplayUrl(e),
    })) as (SystemEntity & { url?: string | null })[];
  }

  async findById(id: string): Promise<SystemEntity & { url?: string | null }> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`System with id "${id}" not found`);
    return { ...entity, config: sanitizeConfig(entity.config), url: getDisplayUrl(entity) } as SystemEntity & { url?: string | null };
  }

  async create(data: Partial<SystemEntity>): Promise<SystemEntity> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    return { ...saved, config: sanitizeConfig(saved.config) } as SystemEntity;
  }

  async update(id: string, data: Partial<SystemEntity>): Promise<SystemEntity> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`System with id "${id}" not found`);
    if (data.config?.auth && entity.config?.auth) {
      const incoming = data.config.auth as Record<string, unknown>;
      const existing = entity.config.auth as Record<string, unknown>;
      if (incoming.password === '' && existing.password) (data.config.auth as Record<string, unknown>).password = existing.password;
      if (incoming.clientSecret === '' && existing.clientSecret) (data.config.auth as Record<string, unknown>).clientSecret = existing.clientSecret;
    }
    Object.assign(entity, data);
    const saved = await this.repo.save(entity);
    return { ...saved, config: sanitizeConfig(saved.config) } as SystemEntity;
  }

  async delete(id: string): Promise<void> {
    const entity = await this.findById(id);
    await this.repo.remove(entity);
  }

  async healthCheck(id: string): Promise<{ systemId: string; status: string; system: string; timestamp: string; statusCode?: number; durationMs?: number; error?: string }> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException(`System with id "${id}" not found`);
    const timestamp = new Date().toISOString();
    if (entity.isMock) {
      return { systemId: entity.id, status: 'mock-healthy', system: entity.name, timestamp };
    }
    const url = getEffectiveBaseUrl(entity);
    if (!url) {
      return { systemId: entity.id, status: 'error', system: entity.name, timestamp, error: 'No URL configured' };
    }
    const start = Date.now();
    try {
      const headers: Record<string, string> = await buildAuthHeaders(entity);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const res = await fetch(url, {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const durationMs = Date.now() - start;
      const ok = res.ok || res.status === 401; // 401 = reachable but unauthorised
      return {
        systemId: entity.id,
        status: ok ? 'healthy' : 'unhealthy',
        system: entity.name,
        timestamp,
        statusCode: res.status,
        durationMs,
        ...(ok ? {} : { error: `HTTP ${res.status}` }),
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      return {
        systemId: entity.id,
        status: 'error',
        system: entity.name,
        timestamp,
        durationMs,
        error,
      };
    }
  }
}
