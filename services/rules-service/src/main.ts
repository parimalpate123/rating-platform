/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const hasRegion = !!process.env.AWS_REGION;
  const hasExplicitCreds =
    !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY;
  if (hasRegion || hasExplicitCreds) {
    logger.log(
      hasExplicitCreds
        ? 'Bedrock: AWS_REGION + credentials from .env'
        : 'Bedrock: credentials from default chain (~/.aws/credentials or env). Set AWS_REGION in .env to choose region.',
    );
  } else {
    logger.warn(
      'Bedrock: optional. Set AWS_REGION in .env and credentials in .env or run "aws configure" (~/.aws/credentials). Otherwise AI features use heuristic only.',
    );
  }

  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);
  app.enableCors();
  const port = process.env.PORT || 4012;
  await app.listen(port);
  logger.log(`Rules Service is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
