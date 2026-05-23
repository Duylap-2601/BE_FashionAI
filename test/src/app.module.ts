import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TryOnModule } from './modules/try-on/try-on.module';
import { StylistModule } from './modules/stylist/stylist.module';

@Module({
  imports: [
    // Load biến môi trường từ .env toàn cục
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Feature Modules
    TryOnModule,
    StylistModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
