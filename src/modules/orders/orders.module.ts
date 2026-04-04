import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CacheModule } from '../cache/cache.module';
import { OrderJobHandlerFactory } from './factories';
import {
  CancelOrderJobStrategy,
  ProcessOrderJobStrategy,
  NotificationJobStrategy,
} from './strategies';
import { ShipOrderJobStrategy } from './strategies/ship-order-job.strategy';
import { DeliverOrderJobStrategy } from './strategies/deliver-order-job.strategy';
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
    ProcessOrderJobStrategy,
    ShipOrderJobStrategy,
    DeliverOrderJobStrategy,
    CancelOrderJobStrategy,
    NotificationJobStrategy,
  ],
  exports: [OrdersService, OrderRepository, OrderItemRepository],
})
export class OrdersModule {}
