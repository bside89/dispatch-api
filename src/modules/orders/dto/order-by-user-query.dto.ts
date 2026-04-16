import { OmitType } from '@nestjs/swagger';
import { OrderQueryDto } from './order-query.dto';

export class OrderByUserQueryDto extends OmitType(OrderQueryDto, [
  'userId',
] as const) {}
