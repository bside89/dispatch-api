import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '../../shared/services/base.service';
import type { IPaymentsGatewayService } from '../payments-gateway/interfaces/payments-gateway-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import type { IOrdersService } from '../orders/interfaces/orders-service.interface';
import { ORDERS_SERVICE } from '../orders/constants/orders.token';
import { IPaymentsService } from './interfaces/payments-service.interface';
import { UpdateOrderPaymentDto } from '../orders/dto/order-payment.dto';
import { PaymentEventType } from '../payments-gateway/enums/payment-event-type.enum';

@Injectable()
export class PaymentsService extends BaseService implements IPaymentsService {
  constructor(
    @Inject(ORDERS_SERVICE) private readonly ordersService: IOrdersService,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentsGatewayService,
  ) {
    super(PaymentsService.name);
  }

  async processWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Promise<void> {
    const event = this.paymentsGatewayService.constructWebhookEvent(
      payload,
      signature,
    );

    if (event.type === PaymentEventType.PAYMENT_SUCCEEDED) {
      const orderId = event.data.metadata?.orderId;
      if (orderId) {
        const dto: UpdateOrderPaymentDto = {
          orderId,
          paymentId: event.data.externalId,
          paymentStatus: event.data.status,
        };
        await this.ordersService.markPaymentAsSucceeded(dto);
      }
    }

    if (event.type === PaymentEventType.PAYMENT_FAILED) {
      const orderId = event.data.metadata?.orderId;
      if (orderId) {
        const dto: UpdateOrderPaymentDto = {
          orderId,
          paymentId: event.data.externalId,
          paymentStatus: event.data.status,
        };
        await this.ordersService.markPaymentAsFailed(dto);
      }
    }
  }
}
