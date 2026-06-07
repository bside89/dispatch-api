import { CursorQueryDto } from '@/shared/dto/cursor-query.dto';
import { OrderStatus } from '../enums/order-status.enum';

export class OrderCursorQueryDto {
  userId?: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  cursor?: CursorQueryDto;
}
