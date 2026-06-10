import { IBaseRepository } from '@/shared/providers/repositories/base-repository.interface';
import { Outbox } from '../entities/outbox.entity';

export interface IOutboxRepository extends IBaseRepository<Outbox> {
  findAndLockBatch(limit?: number): Promise<Outbox[]>;
}
