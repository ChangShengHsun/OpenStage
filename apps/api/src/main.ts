import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env['CORS_ORIGIN'] ?? true });
  const port = Number(process.env['PORT'] ?? 3000);
  await app.listen(port);
}

void bootstrap();
