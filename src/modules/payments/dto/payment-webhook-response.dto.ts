import { ApiProperty } from '@nestjs/swagger';

export class PaymentWebhookResponseDto {
  @ApiProperty({ example: true })
  received: true;
}
