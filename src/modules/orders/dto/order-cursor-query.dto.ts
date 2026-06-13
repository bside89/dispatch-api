import { BaseCursorQueryDto } from '@/shared/dto/base-cursor-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

export class OrderCursorQueryDto extends BaseCursorQueryDto {
  userId?: string;

  status?: OrderStatus;

  startDate?: string;

  endDate?: string;
}
