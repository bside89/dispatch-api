import { BaseRepository } from '@/shared/repositories/base.repository';
import { Outbox } from '../entities/outbox.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { col } from '@/shared/helpers/functions';

const outboxAlias = 'outbox';
const outbox = col<Outbox>(outboxAlias);

export class OutboxRepository extends BaseRepository<Outbox> {
  constructor(
    @InjectRepository(Outbox)
    protected readonly repository: Repository<Outbox>,
  ) {
    super(repository);
  }

  async findAndLockBatch(limit = 50): Promise<Outbox[]> {
    return this.createQueryBuilder(outboxAlias)
      .setLock('pessimistic_write')
      .setOnLocked('skip_locked') // Skip locked rows to prevent blocking other transactions
      .orderBy(outbox('createdAt'), 'ASC')
      .limit(limit)
      .getMany();
  }
}
