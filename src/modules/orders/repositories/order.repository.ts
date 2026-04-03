import { BaseRepository } from '@/shared/repositories/base.repository';
import { Order } from '../entities/order.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderQueryDto } from '../dto/order-query.dto';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { OrderStatus } from '../enums/order-status.enum';

@Injectable()
export class OrderRepository extends BaseRepository<Order> {
  constructor(
    @InjectRepository(Order) protected readonly repository: Repository<Order>,
  ) {
    super(repository);
  }

  async findAllWithFilters(
    query: Partial<OrderQueryDto>,
  ): Promise<PaginatedResultDto<Order>> {
    const manager = this.getManager();

    const queryBuilder = manager
      .createQueryBuilder(Order, 'order')
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.createdAt', 'DESC');

    if (query.userId) {
      queryBuilder.andWhere('order.userId = :userId', {
        userId: query.userId,
      });
    }
    if (query.status) {
      queryBuilder.andWhere('order.status = :status', {
        status: query.status,
      });
    }
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('order.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    // Apply pagination
    const limit = query.limit ? Math.min(query.limit, 100) : 20;
    const skip = (query.page - 1) * limit;

    return queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount()
      .then(
        ([data, total]) =>
          new PaginatedResultDto(total, query.page, limit, data),
      );
  }

  async existsByStatusIn(
    orderId: string,
    statusArray: OrderStatus[],
  ): Promise<boolean> {
    const manager = this.getManager();
    return manager.existsBy(Order, {
      id: orderId,
      status: In(statusArray),
    });
  }
}
