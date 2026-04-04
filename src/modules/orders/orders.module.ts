import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CacheModule } from '../cache/cache.module';
import { OrderJobHandlerFactory } from './factories';
import { OrderProcessor } from './processors/order.processor';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import {
  CancelOrderJobStrategy,
  DeliverOrderJobStrategy,
  ProcessOrderJobStrategy,
  ShipOrderJobStrategy,
} from './strategies';

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
  ],
  exports: [OrdersService, OrderRepository, OrderItemRepository],
})
export class OrdersModule {}
