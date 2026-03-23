import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { typeOrmConfig } from './config/typeorm.config';
import { bullmqConfig } from './config/bullmq.config';
import { OrderModule } from './modules/order/order.module';
import { CacheModule } from './modules/cache/cache.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { JobQueue } from './modules/common/enums/job-queue.enum';
import { AdminController } from './controllers/admin.controller';

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

    // Bull Board (for monitoring queues)
    BullBoardModule.forFeature({
      name: JobQueue.ORDER_PROCESSING,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues', // URL for Bull Board dashboard
      adapter: ExpressAdapter,
    }),

    // Cache (Redis)
    CacheModule,

    // Feature modules
    OrderModule,
  ],
  controllers: [AdminController],
})
export class AppModule {}
