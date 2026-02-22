import { Module } from '@nestjs/common';
import { GwModule } from '../gw/gw.module';

@Module({ imports: [GwModule] })
export class AppModule {}
