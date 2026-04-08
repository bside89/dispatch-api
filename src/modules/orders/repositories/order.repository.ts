import { BaseRepository } from '@/shared/repositories/base.repository';
import { Order } from '../entities/order.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderQueryDto } from '../dto/order-query.dto';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { col } from '@/shared/helpers/functions';

const aliasOrder = 'order';
const order = col<Order>(aliasOrder);

@Injectable()
export class OrderRepository extends BaseRepository<Order> {
  constructor(
    @InjectRepository(Order) protected readonly repository: Repository<Order>,
  ) {
    super(repository);
  }

  async filter(query: Partial<OrderQueryDto>): Promise<PaginatedResultDto<Order>> {
    const queryBuilder = this.createQueryBuilder(aliasOrder).leftJoinAndSelect(
      order('items'),
      'items',
    );

    if (query.userId) {
      queryBuilder.andWhere(`${order('userId')} = :userId`, {
        userId: query.userId,
      });
    }
    if (query.status) {
      queryBuilder.andWhere(`${order('status')} = :status`, {
        status: query.status,
      });
    }
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere(
        `${order('createdAt')} BETWEEN :startDate AND :endDate`,
        {
          startDate: query.startDate,
          endDate: query.endDate,
        },
      );
    }

    // Apply pagination
    const limit = query.limit ? Math.min(query.limit, 100) : 20;
    const skip = (query.page - 1) * limit;

    return queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy(order('createdAt'), 'DESC')
      .getManyAndCount()
      .then(
        ([data, total]) => new PaginatedResultDto(total, query.page, limit, data),
      );
  }
}
