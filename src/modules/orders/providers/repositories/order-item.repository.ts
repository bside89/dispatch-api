import { BaseRepository } from '@/shared/providers/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderItem } from '../../entities/order-item.entity';
import { IOrderItemRepository } from '../../interfaces/order-item-repository.interface';

@Injectable()
export class OrderItemRepository
  extends BaseRepository<OrderItem>
  implements IOrderItemRepository
{
  constructor(
    @InjectRepository(OrderItem)
    protected readonly repository: Repository<OrderItem>,
  ) {
    super(repository);
  }
}
