import { Module } from '@nestjs/common';
import { PlatformApiController } from './platform-api.controller';
import { RatingModule } from '../rating/rating.module';

@Module({
  imports: [RatingModule],
  controllers: [PlatformApiController],
})
export class PlatformApiModule {}
