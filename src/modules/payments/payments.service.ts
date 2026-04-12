import { Injectable } from '@nestjs/common';
import { BaseService } from '../../shared/services/base.service';
import { PaymentsGatewayService } from '../payments-gateway/payments-gateway.service';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService extends BaseService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsGatewayService: PaymentsGatewayService,
  ) {
    super(PaymentsService.name);
  }

  async processWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): Promise<void> {
    const event = this.paymentsGatewayService.constructWebhookEvent(
      payload,
      signature,
      secret,
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as {
        id: string;
        status: string;
        metadata?: Record<string, string>;
      };
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        await this.ordersService.markPaymentAsSucceeded(
          orderId,
          paymentIntent.id,
          paymentIntent.status,
        );
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as {
        id: string;
        status: string;
        metadata?: Record<string, string>;
      };
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        await this.ordersService.markPaymentAsFailed(
          orderId,
          paymentIntent.id,
          paymentIntent.status,
        );
      }
    }
  }
}
