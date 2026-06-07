import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { PaymentCursorQueryDto } from '../dto/payment-cursor-query.dto';
import { Payment } from '../entities/payment.entity';

export interface IPaymentRepository extends IBaseRepository<Payment> {
  filter(query: PaymentCursorQueryDto): Promise<PagCursorResultDto<Payment>>;
}
