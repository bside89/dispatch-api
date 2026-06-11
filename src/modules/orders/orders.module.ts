import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsModule } from '../items/items.module';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersAdminController } from './orders-admin.controller';
import {
  ORDERS_SERVICE,
  ORDER_ITEM_REPOSITORY,
  ORDER_REPOSITORY,
} from './constants/orders.token';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersService } from './orders.service';
import { OrderJobHandlerFactory } from './providers/factories';
import { OrderMessageFactory } from './providers/factories/order-message.factory';
import { OrderProcessor } from './providers/processors/order.processor';
import { OrderItemRepository } from './providers/repositories/order-item.repository';
import { OrderRepository } from './providers/repositories/order.repository';
import {
  CancelOrderJobStrategy,
  ProcessOrderJobStrategy,
} from './providers/strategies';
import { RefundOrderJobStrategy } from '@/modules/orders/providers/strategies';
import { OrdersPublicController } from './orders-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    PaymentsModule,
    ItemsModule,
  ],
  controllers: [OrdersPublicController, OrdersAdminController],
  providers: [
    { provide: ORDERS_SERVICE, useClass: OrdersService },
    { provide: ORDER_REPOSITORY, useClass: OrderRepository },
    { provide: ORDER_ITEM_REPOSITORY, useClass: OrderItemRepository },
    OrderProcessor,
    OrderJobHandlerFactory,
    ProcessOrderJobStrategy,
    CancelOrderJobStrategy,
    RefundOrderJobStrategy,
    OrderMessageFactory,
  ],
  exports: [ORDERS_SERVICE, ORDER_REPOSITORY, ORDER_ITEM_REPOSITORY],
})
export class OrdersModule {}
