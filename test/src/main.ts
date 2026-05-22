import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // ─── Global Prefix ───────────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ─── CORS ────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Global Exception Filter ─────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ─── Swagger ─────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Fashion Try-On API')
    .setDescription(
      `## Hệ thống thử đồ AI tích hợp 2 công nghệ:\n` +
      `- **Virtual Try-On** (Kolors): Tạo ảnh thử đồ thực tế\n` +
      `- **AI Stylist** (Gemini Vision): Phân tích Personal Color & Tư vấn phong cách`,
    )
    .setVersion('2.0.0')
    .addTag('Health', 'Kiểm tra trạng thái API')
    .addTag('Virtual Try-On', 'Thử đồ ảo bằng AI Kolors')
    .addTag('AI Stylist', 'Tư vấn phong cách bằng Gemini Vision')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // ─── Start ────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT ?? 3000;
  await app.listen(PORT);

  logger.log(`🚀 Server running at: http://localhost:${PORT}/api`);
  logger.log(`📖 Swagger UI:        http://localhost:${PORT}/api/docs`);
  logger.log(`👗 Try-On endpoint:   POST http://localhost:${PORT}/api/try-on`);
  logger.log(`🎨 Stylist endpoint:  POST http://localhost:${PORT}/api/stylist/analyze`);
}

bootstrap();
