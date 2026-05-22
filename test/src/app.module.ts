import { Module } from '@nestjs/common';
import { TryOnModule } from './try-on/try-on.module';

/**
 * AppModule - Module chính của ứng dụng NestJS
 * Import TryOnModule để sử dụng tính năng virtual try-on
 */
@Module({
  imports: [TryOnModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
