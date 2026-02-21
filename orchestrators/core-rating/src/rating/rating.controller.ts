import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { RatingService, RateRequest } from './rating.service';

@Controller('rate')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post(':productLineCode')
  @HttpCode(200)
  async rate(
    @Param('productLineCode') productLineCode: string,
    @Body() body: Omit<RateRequest, 'productLineCode'>,
  ) {
    return this.ratingService.rate({ productLineCode, ...body });
  }
}
