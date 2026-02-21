import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SystemsController } from './systems.controller';
import { SystemsService } from './systems.service';
import { SystemEntity } from '../entities/system.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SystemEntity])],
  controllers: [SystemsController],
  providers: [SystemsService],
  exports: [SystemsService],
})
export class SystemsModule {}
