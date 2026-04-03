import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CacheModule } from '../cache/cache.module';
import { OrderJobHandlerFactory } from './factories';
import {
  CancelOrderStrategy,
  ProcessPaymentOrderStrategy,
  NotificationStrategy,
} from './strategies';
import { ShipOrderStrategy } from './strategies/ship-order.strategy';
import { DeliverOrderStrategy } from './strategies/deliver-order.strategy';
import { OrderProcessor } from './processors/order.processor';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), CacheModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrderRepository,
    OrderItemRepository,
    OrderProcessor,
    OrderJobHandlerFactory,
    ProcessPaymentOrderStrategy,
    ShipOrderStrategy,
    DeliverOrderStrategy,
    CancelOrderStrategy,
    NotificationStrategy,
  ],
  exports: [OrdersService, OrderRepository, OrderItemRepository],
})
export class OrdersModule {}
