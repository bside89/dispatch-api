import { IBaseRepository } from '@/shared/providers/repositories/base-repository.interface';
import { OrderItem } from '../entities/order-item.entity';

export interface IOrderItemRepository extends IBaseRepository<OrderItem> {}
