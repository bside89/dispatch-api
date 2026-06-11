import { bullmqDefaultJobOptions } from '@/config/bullmq.config';
import {
  EFFECTS_QUEUE,
  ORDER_QUEUE,
  PAYMENT_QUEUE,
  USER_QUEUE,
} from '@/shared/constants/queues.token';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OUTBOX_REPOSITORY, OUTBOX_SERVICE } from './constants/outbox.token';
import { Outbox } from './entities/outbox.entity';
import { OutboxService } from './outbox.service';
import { OutboxCronProcessor } from './providers/outbox-cron.processor';
import { OutboxRepository } from './providers/repositories/outbox.repository';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox]),
    BullModule.registerQueue({
      name: ORDER_QUEUE,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
    BullModule.registerQueue({
      name: PAYMENT_QUEUE,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
    BullModule.registerQueue({
      name: EFFECTS_QUEUE,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
    BullModule.registerQueue({
      name: USER_QUEUE,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
  ],
  providers: [
    OutboxCronProcessor,
    { provide: OUTBOX_SERVICE, useClass: OutboxService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxRepository },
  ],
  exports: [OUTBOX_SERVICE, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
