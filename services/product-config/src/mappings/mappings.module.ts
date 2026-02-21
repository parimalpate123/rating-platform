import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MappingsController } from './mappings.controller';
import { MappingsService } from './mappings.service';
import { MappingEntity } from '../entities/mapping.entity';
import { FieldMappingEntity } from '../entities/field-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MappingEntity, FieldMappingEntity])],
  controllers: [MappingsController],
  providers: [MappingsService],
  exports: [MappingsService],
})
export class MappingsModule {}
