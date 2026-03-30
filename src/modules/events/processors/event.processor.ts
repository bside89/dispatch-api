import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { BaseProcessor } from '@/shared/processors/base.processor';
import { OutboxType as JobName } from '@/shared/modules/outbox/enums/outbox-type.enum';

@Processor('events', { maxStalledCount: 1 })
export class EventProcessor extends BaseProcessor {
  constructor(private readonly notificationStrategy: NotificationStrategy) {
    super(EventProcessor.name);
  }

  async process(job: Job) {
    switch (job.name) {
      case JobName.EVENTS_NOTIFY_USER:
        return this.notificationStrategy.execute(job, this.logger);
    }
  }
}
