import { Module } from '@nestjs/common';
import { DnbController } from './dnb.controller';
import { DnbService } from './dnb.service';

@Module({
  controllers: [DnbController],
  providers: [DnbService],
})
export class DnbModule {}
