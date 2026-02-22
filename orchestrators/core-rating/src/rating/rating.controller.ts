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

  @Post(':productLineCode/:endpointPath')
  @HttpCode(200)
  async rateWithEndpoint(
    @Param('productLineCode') productLineCode: string,
    @Param('endpointPath') endpointPath: string,
    @Body() body: Omit<RateRequest, 'productLineCode' | 'endpointPath'>,
  ) {
    return this.ratingService.rate({ productLineCode, endpointPath, ...body });
  }
}
