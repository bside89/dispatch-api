// Fix for crypto module issue in TypeORM
if (typeof (global as any).crypto === 'undefined') {
  (global as any).crypto = require('crypto');
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { typeOrmConfig } from './config/typeorm.config';
import { bullmqConfig } from './config/bullmq.config';
import { OrdersModule } from './modules/orders/orders.module';
import { UsersModule } from './modules/users/users.module';
import { CacheModule } from './shared/modules/cache/cache.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { EventsModule } from './shared/modules/events/events.module';
import { AuthModule } from './modules/auth/auth.module';
import { loggerConfig } from './config/logger.config';
import { LoggerModule } from 'nestjs-pino';
import { OutboxModule } from './shared/modules/outbox/outbox.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { TerminusModule } from '@nestjs/terminus';
import { throttleConfig } from './config/throttle.config';
import { EVENT_QUEUE_TOKEN } from './shared/modules/events/constants/event-queue.token';
import { ORDER_QUEUE_TOKEN } from './modules/orders/constants/order-queue.token';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Logger (Pino)
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: loggerConfig,
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: throttleConfig,
      inject: [ConfigService],
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
    // forRoot MUST come before forFeature so BULL_BOARD_TOKEN is registered first
    BullBoardModule.forRoot({
      route: '/bull-board',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature(
      {
        name: ORDER_QUEUE_TOKEN,
        adapter: BullMQAdapter,
      },
      {
        name: EVENT_QUEUE_TOKEN,
        adapter: BullMQAdapter,
      },
    ),

    // Scheduler (for cron jobs)
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    OrdersModule,
    UsersModule,
    EventsModule,
    CacheModule,
    OutboxModule,
    TerminusModule,
  ],
  controllers: [AppController],
  providers: [
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global Roles Guard (for role-based access control)
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
