import { Injectable, Inject } from '@nestjs/common';
import { BaseService } from '../../shared/services/base.service';
import type { IPaymentGatewaysService } from '../payment-gateways/interfaces/payment-gateways-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '../payment-gateways/constants/payments-gateway.token';
import type { IOrdersService } from '../orders/interfaces/orders-service.interface';
import { ORDERS_SERVICE } from '../orders/constants/orders.token';
import { IPaymentsService } from './interfaces/payments-service.interface';
import { UpdateOrderPaymentDto } from '../orders/dto/order-payment.dto';
import { PaymentEventType } from '../payment-gateways/enums/payment-event-type.enum';

@Injectable()
export class PaymentsService extends BaseService implements IPaymentsService {
  constructor(
    @Inject(ORDERS_SERVICE) private readonly ordersService: IOrdersService,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentGatewaysService,
  ) {
    super(PaymentsService.name);
  }

  async processWebhookEvent(
    payload: Buffer | string,
    signature: string,
  ): Promise<void> {
    const event = this.paymentsGatewayService.webhooks.constructWebhookEvent(
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
