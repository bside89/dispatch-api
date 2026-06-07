import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { Refund } from '../entities/refund.entity';

export interface IRefundRepository extends IBaseRepository<Refund> {}
