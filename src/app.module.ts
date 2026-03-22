import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { typeOrmConfig } from './config/typeorm.config';
import { bullmqConfig } from './config/bullmq.config';
import { OrderModule } from './modules/order/order.module';
import { CacheModule } from './modules/cache/cache.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: typeOrmConfig,
      inject: [ConfigService],
    }),

    // BullMQ Queue (for job processing)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: bullmqConfig,
      inject: [ConfigService],
    }),

    // Cache (Redis)
    CacheModule,

    // Feature modules
    OrderModule,
  ],
})
export class AppModule {}
