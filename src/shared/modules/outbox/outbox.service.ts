import { Outbox } from './entities/outbox.entity';
import { Injectable } from '@nestjs/common';
import { OutboxType } from './enums/outbox-type.enum';
import { OutboxRepository } from './repositories/outbox.repository';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';

@Injectable()
export class OutboxService {
  constructor(private readonly repository: OutboxRepository) {}

  async add(type: OutboxType, payload: any): Promise<void> {
    const correlationId = RequestContext.getCorrelationId() ?? randomUUID();
    const outboxEntry = this.repository.createEntity({
      type,
      payload,
      correlationId,
      createdAt: new Date(),
    });
    await this.repository.save(outboxEntry);
  }
}
