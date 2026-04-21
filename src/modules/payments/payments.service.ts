import { Injectable, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { BaseService } from '../../shared/services/base.service';
import type { IPaymentsGatewayService } from '../payments-gateway/interfaces/payments-gateway-service.interface';
import { PAYMENTS_GATEWAY_SERVICE } from '../payments-gateway/constants/payments-gateway.token';
import type { IOrdersService } from '../orders/interfaces/orders-service.interface';
import { ORDERS_SERVICE } from '../orders/constants/orders.token';
import { IPaymentsService } from './interfaces/payments-service.interface';
import { ConfigService } from '@nestjs/config';
import { PaymentIntentUpdateDto } from '../orders/dto/payment-intent-update.dto';

@Injectable()
export class PaymentsService
  extends BaseService
  implements IPaymentsService, OnApplicationBootstrap
{
  private webhookSecret: string;

  constructor(
    @Inject(ORDERS_SERVICE) private readonly ordersService: IOrdersService,
    @Inject(PAYMENTS_GATEWAY_SERVICE)
    private readonly paymentsGatewayService: IPaymentsGatewayService,
    private readonly configService: ConfigService,
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
      this.webhookSecret,
    );

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as {
        id: string;
        status: string;
        metadata?: Record<string, string>;
      };
      const orderId = paymentIntent.metadata?.orderId;
      if (orderId) {
        const dto: PaymentIntentUpdateDto = {
          orderId,
          paymentIntentId: paymentIntent.id,
          paymentIntentStatus: paymentIntent.status,
        };
        await this.ordersService.markPaymentAsSucceeded(dto);
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
        const dto: PaymentIntentUpdateDto = {
          orderId,
          paymentIntentId: paymentIntent.id,
          paymentIntentStatus: paymentIntent.status,
        };
        await this.ordersService.markPaymentAsFailed(dto);
      }
    }
  }

  onApplicationBootstrap() {
    this.webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
  }
}
