import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env['MINIO_ENDPOINT'] || process.env['S3_ENDPOINT'];
    this.bucket = process.env['S3_BUCKET'] || 'rating-platform-kb';

    this.client = new S3Client({
      region: process.env['AWS_REGION'] || 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      credentials: {
        accessKeyId:
          process.env['MINIO_ACCESS_KEY'] ||
          process.env['AWS_ACCESS_KEY_ID'] ||
          'minioadmin',
        secretAccessKey:
          process.env['MINIO_SECRET_KEY'] ||
          process.env['AWS_SECRET_ACCESS_KEY'] ||
          'minioadmin',
      },
      // Required for MinIO path-style addressing
      forcePathStyle: !!endpoint,
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket: ${this.bucket}`);
      } catch (err: any) {
        if (err.name !== 'BucketAlreadyOwnedByYou') {
          this.logger.warn(`Could not create bucket: ${err.message}`);
        }
      }
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<{ bucket: string; key: string }> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    this.logger.log(`Uploaded: ${this.bucket}/${key}`);
    return { bucket: this.bucket, key };
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log(`Deleted: ${this.bucket}/${key}`);
  }
}
