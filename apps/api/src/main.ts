import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
// Load root .env (monorepo) trước khi Prisma đọc DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  await app.listen(process.env.API_PORT ? Number(process.env.API_PORT) : 3001);
}
// eslint-disable-next-line no-console
bootstrap().catch((e) => { console.error(e); process.exit(1); });
