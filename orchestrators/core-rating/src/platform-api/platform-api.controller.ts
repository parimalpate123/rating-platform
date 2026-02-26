import { Controller, Post, Body, Param, HttpCode } from '@nestjs/common';
import { RatingService } from '../rating/rating.service';
import { normalizeBody } from '../rating/normalize-body';

@Controller(':productCode')
export class PlatformApiController {
  constructor(private readonly ratingService: RatingService) {}

  /**
   * POST /api/v1/{productCode}/rate
   * Product-first public API — uses the default 'rate' flow.
   */
  @Post('rate')
  @HttpCode(200)
  async rate(
    @Param('productCode') productCode: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ratingService.rate({ productLineCode: productCode, ...normalizeBody(body) });
  }

  /**
   * POST /api/v1/{productCode}/rate/{flowName}
   * Product-first public API with a named flow (e.g., /init-rate, /quote, /renew).
   */
  @Post('rate/:flowName')
  @HttpCode(200)
  async rateWithFlow(
    @Param('productCode') productCode: string,
    @Param('flowName') flowName: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ratingService.rate({
      productLineCode: productCode,
      endpointPath: flowName,
      ...normalizeBody(body),
    });
  }
}
