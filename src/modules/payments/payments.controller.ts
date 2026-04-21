import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { BaseController } from '../../shared/controllers/base.controller';
import type { IPaymentsService } from './interfaces/payments-service.interface';
import { PAYMENTS_SERVICE } from './constants/payments.token';
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
import { I18N_PAYMENTS } from '@/shared/constants/i18n';
import { template } from '@/shared/utils/functions.utils';

@Controller({ path: 'v1/payments', version: '1' })
@ApiTags('payments')
@ApiSecurity('bearer')
export class PaymentsController extends BaseController {
  constructor(
    @Inject(PAYMENTS_SERVICE) private readonly paymentsService: IPaymentsService,
  ) {
    super(PaymentsController.name);
  }

  @Post('webhooks/payment')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment webhook endpoint',
    description:
      'Receives payment gateway events and updates the corresponding order.',
  })
  @ApiHeader({
    name: 'webhook-signature',
    description: 'Payment gateway webhook signature header',
    required: true,
  })
  @ApiBody({
    type: PaymentWebhookDto,
    description: 'Payment gateway event payload',
  })
  @ApiOkResponse({
    description: 'Webhook processed successfully',
    type: PaymentWebhookResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid webhook signature or payload',
  })
  async handlePaymentWebhook(
    @Req() request: Request & { rawBody?: Buffer },
    @Headers('webhook-signature') webhookSignature: string,
  ): Promise<PaymentWebhookResponseDto> {
    if (!webhookSignature) {
      throw new BadRequestException(
        template(I18N_PAYMENTS.ERRORS.WEBHOOK_SIGNATURE_REQUIRED),
      );
    }

    await this.paymentsService.processWebhookEvent(
      request.rawBody,
      webhookSignature,
    );

    return { received: true };
  }
}
