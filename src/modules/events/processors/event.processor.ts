import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotifyUserJobData } from '../misc/events-job-data';
import { NotificationStrategy } from '../strategies/notification.strategy';
import { Logger } from '@nestjs/common';

@Processor('events')
export class EventProcessor extends WorkerHost {
  private readonly logger = new Logger(EventProcessor.name);

  constructor(private readonly notificationStrategy: NotificationStrategy) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case NotifyUserJobData.name:
        return this.notificationStrategy.execute(job, this.logger);
    }
  }
}
