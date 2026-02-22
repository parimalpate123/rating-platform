import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadedFileEntity } from '../entities/uploaded-file.entity';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { S3Service } from './s3.service';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedFileEntity])],
  providers: [KnowledgeBaseService, S3Service],
  controllers: [KnowledgeBaseController],
  exports: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
