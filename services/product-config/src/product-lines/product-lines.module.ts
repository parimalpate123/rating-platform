import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductLinesController } from './product-lines.controller';
import { ProductLinesService } from './product-lines.service';
import { ProductLineEntity } from '../entities/product-line.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductLineEntity]), ActivityLogModule],
  controllers: [ProductLinesController],
  providers: [ProductLinesService],
  exports: [ProductLinesService],
})
export class ProductLinesModule {}
