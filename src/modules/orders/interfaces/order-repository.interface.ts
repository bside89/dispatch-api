import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { Order } from '../entities/order.entity';
import { OrderQueryDto } from '../dto/order-query.dto';

export interface IOrderRepository extends IBaseRepository<Order> {
  filter(query: Partial<OrderQueryDto>): Promise<PaginatedResultDto<Order>>;
}
