import { Module } from '@nestjs/common';
import { TryOnController } from './try-on.controller';
import { TryOnService } from './try-on.service';

/**
 * TryOnModule - Module chứa tất cả dependencies cho tính năng virtual try-on
 * Exports: TryOnController, TryOnService
 */
@Module({
  controllers: [TryOnController],
  providers: [TryOnService],
  exports: [TryOnService],
})
export class TryOnModule {}
