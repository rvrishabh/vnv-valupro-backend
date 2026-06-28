import 'dotenv/config';
import fastifyCookie from '@fastify/cookie';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }), // NestJS logger handles this
  );

  await app.register(fastifyCookie);

  // ─── Global prefix ────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── Validation ───────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip fields not in DTO
      forbidNonWhitelisted: true, // throw if unknown fields sent
      transform: true, // convert types (string → number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── CORS ─────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? true, // true = reflect origin (dev only)
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ─── Swagger ──────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VNV ValuPro API')
      .setDescription('Bank property valuation platform — VNV Engineers')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs available at /api/docs');
  }

  // ─── Graceful shutdown ────────────────────────────
  app.enableShutdownHooks();

  // ─── Start ────────────────────────────────────────
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0'); // 0.0.0.0 required for Railway

  logger.log(`VNV ValuPro API running on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Failed to start application', err);
  process.exit(1);
});
