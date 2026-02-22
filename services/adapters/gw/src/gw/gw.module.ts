import { Module } from '@nestjs/common';
import { GwController } from './gw.controller';
import { GwService } from './gw.service';

@Module({
  controllers: [GwController],
  providers: [GwService],
})
export class GwModule {}
