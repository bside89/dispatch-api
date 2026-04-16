import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { BaseController } from '../../shared/controllers/base.controller';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorators/public.decorator';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentWebhookResponseDto } from './dto/payment-webhook-response.dto';
import { ConfigService } from '@nestjs/config';
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { template } from '@/shared/helpers/functions';

@Controller({ path: 'v1/payments', version: '1' })
@ApiTags('payments')
@ApiSecurity('bearer')
export class PaymentsController extends BaseController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {
    super(PaymentsController.name);
  }

  @Post('webhooks/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint',
    description:
      'Receives Stripe payment intent events and updates the corresponding order.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Stripe webhook signature header',
    required: true,
  })
  @ApiBody({
    type: PaymentWebhookDto,
    description: 'Stripe event payload',
  })
  @ApiOkResponse({
    description: 'Webhook processed successfully',
    type: PaymentWebhookResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid webhook signature or payload',
  })
  async handleStripeWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') stripeSignature: string,
  ): Promise<PaymentWebhookResponseDto> {
    if (!stripeSignature) {
      throw new BadRequestException(
        template(I18N_PAYMENTS.ERRORS.STRIPE_SIGNATURE_REQUIRED),
      );
    }

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new BadRequestException(
        template(I18N_PAYMENTS.ERRORS.WEBHOOK_SECRET_REQUIRED),
      );
    }

    await this.paymentsService.processWebhookEvent(
      request.rawBody,
      stripeSignature,
      webhookSecret,
    );

    return { received: true };
  }
}
