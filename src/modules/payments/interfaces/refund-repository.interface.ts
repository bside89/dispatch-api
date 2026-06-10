import { IBaseRepository } from '@/shared/providers/repositories/base-repository.interface';
import { Refund } from '../entities/refund.entity';

export interface IRefundRepository extends IBaseRepository<Refund> {}
