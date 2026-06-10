import { BaseService } from '@/shared/providers/services/base.service';
import { RequestContext } from '@/shared/utils/request-context.utils';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { OUTBOX_REPOSITORY } from './constants/outbox.token';
import type { IOutboxRepository } from './interfaces/outbox-repository.interface';
import { IOutboxService } from './interfaces/outbox-service.interface';
import { BaseOutboxJobPayload } from './payloads/outbox.payload';
import { OutboxScheduler } from './providers/outbox.scheduler';

@Injectable()
export class OutboxService extends BaseService implements IOutboxService {
  constructor(
    @Inject(OUTBOX_REPOSITORY) private readonly outboxRepository: IOutboxRepository,
    private readonly outboxScheduler: OutboxScheduler,
  ) {
    super(OutboxService.name);
  }

  async add<T extends BaseOutboxJobPayload>(outboxPayload: T): Promise<void> {
    const correlationId = RequestContext.getCorrelationId() ?? randomUUID();
    const outboxEntry = this.outboxRepository.createEntity({
      type: outboxPayload.type,
      payload: outboxPayload,
      correlationId,
    });
    await this.outboxRepository.save(outboxEntry);

    // Trigger immediate processing after adding a new message to the outbox
    setImmediate(() => this.outboxScheduler.process());
  }
}
