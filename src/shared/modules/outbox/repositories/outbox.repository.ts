import { BaseRepository } from '@/shared/repositories/base.repository';
import { Outbox } from '../entities/outbox.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

export class OutboxRepository extends BaseRepository<Outbox> {
  constructor(
    @InjectRepository(Outbox)
    protected readonly repository: Repository<Outbox>,
  ) {
    super(repository);
  }

  async findAllByCreatedAt(reverse = false): Promise<Outbox[]> {
    const manager = this.getManager();

    return manager.find(Outbox, {
      order: {
        createdAt: reverse ? 'DESC' : 'ASC',
      },
      take: 50,
    });
  }
}
