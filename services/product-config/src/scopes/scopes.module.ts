import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScopesController } from './scopes.controller';
import { ScopesService } from './scopes.service';
import { ProductScopeEntity } from '../entities/product-scope.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ProductScopeEntity])],
  controllers: [ScopesController],
  providers: [ScopesService],
  exports: [ScopesService],
})
export class ScopesModule {}
