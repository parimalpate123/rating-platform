import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { RatingService } from './rating.service';
import { normalizeBody } from './normalize-body';

@Controller('rate')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Post(':productLineCode')
  @HttpCode(200)
  async rate(
    @Param('productLineCode') productLineCode: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ratingService.rate({ productLineCode, ...normalizeBody(body) });
  }

  @Post(':productLineCode/:endpointPath')
  @HttpCode(200)
  async rateWithEndpoint(
    @Param('productLineCode') productLineCode: string,
    @Param('endpointPath') endpointPath: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ratingService.rate({ productLineCode, endpointPath, ...normalizeBody(body) });
  }
}
