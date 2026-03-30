import { Outbox } from './entities/outbox.entity';
import { Injectable } from '@nestjs/common';
import { OutboxType } from './enums/outbox-type.enum';
import { OutboxRepository } from './repositories/outbox.repository';

@Injectable()
export class OutboxService {
  constructor(private readonly repository: OutboxRepository) {}

  async add(type: OutboxType, payload: any): Promise<void> {
    const outboxEntry = this.repository.createEntity({
      type,
      payload,
      createdAt: new Date(),
    });
    await this.repository.save(outboxEntry);
  }
}
