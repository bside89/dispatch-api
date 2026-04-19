import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicOrdersController } from './public-orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderJobHandlerFactory } from './factories';
import { OrderProcessor } from './processors/order.processor';
import { OrderRepository } from './repositories/order.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { CancelOrderJobStrategy, ProcessOrderJobStrategy } from './strategies';
import { RefundOrderJobStrategy } from './strategies/refund-order-job.strategy';
import { PaymentsGatewayModule } from '../payments-gateway/payments-gateway.module';
import { ItemsModule } from '../items/items.module';
import { OrderMessageFactory } from './factories/order-message.factory';
import { OrderTransitionPolicy } from './services/order-transition-policy.service';
import {
  ORDERS_SERVICE,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
} from './constants/orders.token';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    PaymentsGatewayModule,
    ItemsModule,
  ],
  controllers: [PublicOrdersController, AdminOrdersController],
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
    OrderTransitionPolicy,
  ],
  exports: [ORDERS_SERVICE, ORDER_REPOSITORY, ORDER_ITEM_REPOSITORY],
})
export class OrdersModule {}
