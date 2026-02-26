import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  providers: [RatingService],
  controllers: [RatingController],
  exports: [RatingService],
})
export class RatingModule {}
