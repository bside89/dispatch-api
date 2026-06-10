import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { BaseRepository } from '@/shared/providers/repositories/base.repository';
import { col } from '@/shared/utils/functions.utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentCursorQueryDto } from '../../dto/payment-cursor-query.dto';
import { Payment } from '../../entities/payment.entity';
import { IPaymentRepository } from '../../interfaces/payment-repository.interface';

const ALIAS_PAYMENT = 'payment';
const payment = col<Payment>(ALIAS_PAYMENT);

@Injectable()
export class PaymentRepository
  extends BaseRepository<Payment>
  implements IPaymentRepository
{
  constructor(@InjectRepository(Payment) repository: Repository<Payment>) {
    super(repository);
  }

  async filter(query: PaymentCursorQueryDto): Promise<PagCursorResultDto<Payment>> {
    const { userId, orderId, cursor } = query;
    const limit = cursor?.limit || 20;

    const queryBuilder = this.createQueryBuilder(ALIAS_PAYMENT)
      .where(`${payment('deletedAt')} IS NULL`)
      .orderBy(`${payment('createdAt')}`, 'DESC')
      .addOrderBy(`${payment('id')}`, 'DESC')
      .take(limit + 1);

    if (userId) {
      queryBuilder.andWhere(`${payment('userId')} = :userId`, {
        userId,
      });
    }

    if (orderId) {
      queryBuilder.andWhere(`${payment('orderId')} = :orderId`, {
        orderId,
      });
    }

    if (cursor) {
      queryBuilder.andWhere(`${payment('createdAt')} < :cursorCreatedAt`, {
        cursorCreatedAt: cursor.startingAfter,
      });
    }

    const payments = await queryBuilder.getMany();
    const hasNextPage = payments.length > limit;
    const items = hasNextPage ? payments.slice(0, -1) : payments;
    const lastItem = items[items.length - 1];

    return {
      items,
      nextCursor: hasNextPage && lastItem ? this.encodeCursor(lastItem) : null,
      hasMore: hasNextPage,
    };
  }

  private encodeCursor(payment: Payment): string {
    const cursor: PaymentCursorQueryDto = {
      userId: payment.userId,
      orderId: payment.orderId,
      cursor: {
        startingAfter: payment.createdAt.toISOString(),
      },
    };

    return Buffer.from(JSON.stringify(cursor)).toString('base64');
  }
}
