import { CreatePgwPaymentDto } from './create-pgw-payment.dto';

export class CreatePaymentDto {
  orderId: string;

  userId: string;

  gatewayDto: CreatePgwPaymentDto;
}
