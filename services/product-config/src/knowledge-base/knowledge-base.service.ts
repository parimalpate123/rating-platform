import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { UploadedFileEntity } from '../entities/uploaded-file.entity';
import { S3Service } from './s3.service';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectRepository(UploadedFileEntity)
    private readonly repo: Repository<UploadedFileEntity>,
    private readonly s3: S3Service,
  ) {}

  async findAll(productLineCode?: string): Promise<UploadedFileEntity[]> {
    const where: any = {};
    if (productLineCode) where.productLineCode = productLineCode;
    return this.repo.find({ where, order: { uploadedAt: 'DESC' } });
  }

  async findById(id: string): Promise<UploadedFileEntity> {
    const file = await this.repo.findOne({ where: { id } });
    if (!file) throw new NotFoundException(`Document ${id} not found`);
    return file;
  }

  async upload(
    originalName: string,
    buffer: Buffer,
    mimeType: string,
    metadata: { productLineCode?: string; description?: string; tags?: string[] },
  ): Promise<UploadedFileEntity> {
    const ext = path.extname(originalName).replace('.', '').toLowerCase();
    const fileType = this.resolveFileType(ext);
    const s3Key = `kb/${Date.now()}-${originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { bucket } = await this.s3.upload(s3Key, buffer, mimeType);

    // Basic text extraction for plain-text formats
    let extractedText: string | undefined;
    if (fileType === 'txt' || fileType === 'md' || fileType === 'csv' || fileType === 'json') {
      try {
        extractedText = buffer.toString('utf-8');
      } catch {
        this.logger.warn(`Text extraction failed for ${originalName}`);
      }
    }

    const record = this.repo.create({
      filename: originalName,
      fileType: fileType as any,
      fileSizeBytes: buffer.length,
      s3Key,
      s3Bucket: bucket,
      storagePath: `s3://${bucket}/${s3Key}`,
      productLineCode: metadata.productLineCode,
      description: metadata.description,
      tags: metadata.tags ?? [],
      aiStatus: extractedText ? 'ready' : 'pending',
      extractedText,
      processedAt: extractedText ? new Date() : undefined,
    });

    return this.repo.save(record);
  }

  async update(id: string, dto: { description?: string; tags?: string[]; productLineCode?: string }): Promise<UploadedFileEntity> {
    await this.findById(id);
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const file = await this.findById(id);
    if (file.s3Key) {
      await this.s3.delete(file.s3Key).catch((err: any) =>
        this.logger.warn(`S3 delete failed for ${file.s3Key}: ${err.message}`),
      );
    }
    await this.repo.delete(id);
  }

  async getDownloadUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    const file = await this.findById(id);
    if (!file.s3Key) throw new NotFoundException(`No S3 key for document ${id}`);
    const url = await this.s3.getSignedDownloadUrl(file.s3Key);
    return { url, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() };
  }

  async reprocess(id: string): Promise<UploadedFileEntity> {
    const file = await this.findById(id);
    await this.repo.update(id, { aiStatus: 'pending', processingError: undefined as any });
    this.logger.log(`Reprocess requested for ${file.filename} (${id})`);
    return this.findById(id);
  }

  async search(query: string, productLineCode?: string): Promise<{
    results: Array<{ documentId: string; filename: string; relevance: number; excerpt: string }>;
    query: string;
    totalFound: number;
  }> {
    const qb = this.repo.createQueryBuilder('f');
    if (productLineCode) {
      qb.andWhere('f.product_line_code = :productLineCode', { productLineCode });
    }
    qb.andWhere(
      `to_tsvector('english', COALESCE(f.extracted_text, '')) @@ plainto_tsquery('english', :query)`,
      { query },
    );
    qb.andWhere('f.extracted_text IS NOT NULL');
    qb.orderBy(
      `ts_rank(to_tsvector('english', COALESCE(f.extracted_text, '')), plainto_tsquery('english', :query2))`,
      'DESC',
    );
    qb.setParameter('query2', query);

    const files = await qb.getMany();

    const results = files.map((f) => {
      const text = f.extractedText ?? '';
      const idx = text.toLowerCase().indexOf(query.toLowerCase());
      const start = Math.max(0, idx - 100);
      const end = Math.min(text.length, idx + 200);
      const excerpt = idx >= 0 ? `...${text.slice(start, end)}...` : text.slice(0, 200);
      return { documentId: f.id, filename: f.filename, relevance: 1.0, excerpt };
    });

    return { results, query, totalFound: results.length };
  }

  private resolveFileType(ext: string): string {
    const map: Record<string, string> = {
      pdf: 'pdf', docx: 'docx', doc: 'doc',
      xlsx: 'xlsx', csv: 'csv', json: 'json',
      txt: 'txt', md: 'md',
    };
    return map[ext] ?? 'txt';
  }
}
