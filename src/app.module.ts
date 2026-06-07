import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'fs';
import { AcceptLanguageResolver, I18nModule, QueryResolver } from 'nestjs-i18n';
import { LoggerModule } from 'nestjs-pino';
import * as path from 'path';
import { AppController } from './app.controller';
import { bullmqConfig } from './config/bullmq.config';
import { loggerConfig } from './config/logger.config';
import { throttleConfig } from './config/throttle.config';
import { typeOrmConfig } from './config/typeorm.config';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { LoggingMiddleware } from './middleware/logging.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { EffectsModule } from './modules/effects/effects.module';
import { ItemsModule } from './modules/items/items.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import {
  EFFECTS_QUEUE,
  ORDER_QUEUE,
  PAYMENT_QUEUE,
  USER_QUEUE,
} from './shared/constants/queues.token';
import { CacheModule } from './shared/modules/cache/cache.module';
import { DbGuardModule } from './shared/modules/db-guard/db-guard.module';
import { OutboxModule } from './shared/modules/outbox/outbox.module';
import { SeedDataService } from './shared/services/seed-data.service';

const i18nPath = [
  path.join(__dirname, 'i18n'),
  path.join(__dirname, '..', 'i18n'),
  path.join(process.cwd(), 'src', 'i18n'),
].find((candidatePath) => existsSync(candidatePath));

const envFilePath = `.env.${process.env.NODE_ENV || 'local'}`;

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
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
        name: ORDER_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: EFFECTS_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: PAYMENT_QUEUE,
        adapter: BullMQAdapter,
      },
      {
        name: USER_QUEUE,
        adapter: BullMQAdapter,
      },
    ),

    // Internationalization (i18n)
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: i18nPath ?? path.join(__dirname, 'i18n'),
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),

    // Scheduler (for cron jobs)
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    OrdersModule,
    UsersModule,
    ItemsModule,
    EffectsModule,
    CacheModule,
    DbGuardModule,
    OutboxModule,
    TerminusModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    SeedDataService,

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
    consumer.apply(CorrelationIdMiddleware, LoggingMiddleware).forRoutes('*');
  }
}
