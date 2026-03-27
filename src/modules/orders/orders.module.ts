import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CacheModule } from '../cache/cache.module';
import { OrderJobHandlerFactory } from './factories';
import {
  CancelOrderStrategy,
  ProcessOrderStrategy,
  NotificationStrategy,
} from './strategies';
import { ShipOrderStrategy } from './strategies/ship-order.strategy';
import { DeliverOrderStrategy } from './strategies/deliver-order.strategy';
import { OrderProcessor } from './processors/order.processor';
import { bullmqDefaultJobOptions } from '../../config/bullmq.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    BullModule.registerQueue({
      name: 'orders',
      defaultJobOptions: bullmqDefaultJobOptions,
    }),
    CacheModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderProcessor,
    OrderJobHandlerFactory,
    ProcessOrderStrategy,
    ShipOrderStrategy,
    DeliverOrderStrategy,
    CancelOrderStrategy,
    NotificationStrategy,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
