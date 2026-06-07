import { CursorQueryDto } from '@/shared/dto/cursor-query.dto';

export class PaymentCursorQueryDto {
  userId?: string;

  orderId?: string;

  cursor?: CursorQueryDto;
}
