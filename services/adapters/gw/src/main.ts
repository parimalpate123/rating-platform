import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  const port = process.env['PORT'] || 3012;
  await app.listen(port);
  Logger.log(`GW Adapter is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
