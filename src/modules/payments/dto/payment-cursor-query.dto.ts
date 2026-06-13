import { BaseCursorQueryDto } from '@/shared/dto/base-cursor-query.dto';

export class PaymentCursorQueryDto extends BaseCursorQueryDto {
  userId?: string;

  orderId?: string;
}
