import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { OutboxType as JobName } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';
import { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Processor('events', { maxStalledCount: 1 })
export class EventProcessor
  extends BaseProcessor
  implements OnApplicationBootstrap
{
  constructor(
    private readonly notificationStrategy: NotificationStrategy,
    private readonly configService: ConfigService,
  ) {
    super(EventProcessor.name);
  }

  onApplicationBootstrap() {
    const concurrency = this.configService.get<string>(
      'QUEUE_EVENT_CONCURRENCY',
    );
    this.setupConcurrency(Number(concurrency));
  }

  async process(job: Job) {
    const correlationId = job.data?.correlationId ?? randomUUID();

    return RequestContext.run(correlationId, async () => {
      switch (job.name) {
        case JobName.EVENTS_NOTIFY_USER:
          return this.notificationStrategy.execute(job, this.logger);
      }
    });
  }

  getConcurrencyMultiplier(): number {
    return 2;
  }
}
