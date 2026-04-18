import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OrderItem } from '../entities/order-item.entity';
import { Repository } from 'typeorm';
import { IOrderItemRepository } from '../interfaces/order-item-repository.interface';

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
