import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  const port = process.env['PORT'] || 3011;
  await app.listen(port);
  Logger.log(`D&B Adapter is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
