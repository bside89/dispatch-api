import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { Order } from '../entities/order.entity';
import { OrderQueryDto } from '../dto/order-query.dto';

export interface IOrderRepository extends IBaseRepository<Order> {
  filter(query: Partial<OrderQueryDto>): Promise<PagOffsetResultDto<Order>>;
}
