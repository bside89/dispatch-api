import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/providers/repositories/base-repository.interface';
import { OrderCursorQueryDto } from '../dto/order-cursor-query.dto';
import { Order } from '../entities/order.entity';

export interface IOrderRepository extends IBaseRepository<Order> {
  filter(query: OrderCursorQueryDto): Promise<PagCursorResultDto<Order>>;
}
