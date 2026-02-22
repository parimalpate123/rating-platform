import { Module } from '@nestjs/common';
import { DnbModule } from '../dnb/dnb.module';

@Module({ imports: [DnbModule] })
export class AppModule {}
