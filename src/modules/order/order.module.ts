import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { OrderProcessor } from './order.processor';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { JobQueue } from '../common/enums/job-queue.enum';
import { CacheModule } from '../cache/cache.module';
import { JobHandlerFactory, StatusNotificationFactory } from './factories';
import {
  CancelOrderStrategy,
  ProcessOrderStrategy,
  NotificationStrategy,
} from './strategies';
import { ShipOrderStrategy } from './strategies/ship-order.strategy';
import { DeliverOrderStrategy } from './strategies/deliver-order.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    BullModule.registerQueue({
      name: JobQueue.ORDER_FLOW,
      defaultJobOptions: {
        attempts: 3, // Try 3 times before marking as failed
        backoff: 3000, // Wait 3s between attempts
        removeOnFail: { age: 24 * 3600 }, // Remove failed jobs after 24h
      },
    }),
    CacheModule,
  ],
  controllers: [OrderController],
  providers: [
    OrderService,
    OrderProcessor,
    StatusNotificationFactory,
    JobHandlerFactory,
    ProcessOrderStrategy,
    ShipOrderStrategy,
    DeliverOrderStrategy,
    CancelOrderStrategy,
    NotificationStrategy,
  ],
  exports: [OrderService],
})
export class OrderModule {}
