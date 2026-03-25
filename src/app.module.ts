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
import { OrderModule } from './modules/order/order.module';
import { UserModule } from './modules/user/user.module';
import { CacheModule } from './modules/cache/cache.module';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { AdminController } from './controllers/admin.controller';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt.guard';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { EventsModule } from './modules/events/events.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000, // 1 minute
          limit: 10, // Limit to 10 requests per minute for all endpoints
        },
      ],
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
    BullBoardModule.forFeature(
      {
        name: 'orders',
        adapter: BullMQAdapter,
      },
      {
        name: 'events',
        adapter: BullMQAdapter,
      },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues', // URL for Bull Board dashboard
      adapter: ExpressAdapter,
    }),

    // Cache (Redis)
    CacheModule,

    // Feature modules
    OrderModule,
    EventsModule,
    UserModule,
  ],
  controllers: [AdminController],
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
export class AppModule {}
