import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
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
import { RefundOrderJobStrategy } from './strategies/refund-order-job.strategy';
import { PaymentsGatewayModule } from '../payments-gateway/payments-gateway.module';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem]),
    PaymentsGatewayModule,
    ItemsModule,
  ],
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
    RefundOrderJobStrategy,
  ],
  exports: [OrdersService, OrderRepository, OrderItemRepository],
})
export class OrdersModule {}
