import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap function - Khởi động ứng dụng NestJS
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefix chung cho tất cả routes
  app.setGlobalPrefix('api');

  // Enable CORS nếu cần
  app.enableCors({
    origin: '*', // Điều chỉnh theo môi trường thực
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('AI Fashion Try-On API')
    .setDescription('The Virtual Try-On API documentation')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const PORT = process.env.PORT || 3000;
  await app.listen(PORT, () => {
    console.log(`🚀 AI Fashion Try-On API đang chạy tại: http://localhost:${PORT}`);
    console.log(`📍 Endpoint: POST http://localhost:${PORT}/api/try-on`);
    console.log(`📖 Swagger UI: http://localhost:${PORT}/api/docs`);
  });
}

bootstrap();
