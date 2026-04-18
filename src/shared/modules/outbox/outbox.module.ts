import { OutboxService } from './outbox.service';
import { Global, Module } from '@nestjs/common';
import { OutboxRepository } from './repositories/outbox.repository';
import { bullmqDefaultJobOptions } from '@/config/bullmq.config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from './entities/outbox.entity';
import {
  ORDER_QUEUE_TOKEN,
  PAYMENT_QUEUE_TOKEN,
} from '@/shared/constants/queue-tokens.constant';
import { OUTBOX_SERVICE, OUTBOX_REPOSITORY } from './constants/outbox.tokens';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox]),
    BullModule.registerQueue({
      name: ORDER_QUEUE_TOKEN,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
    BullModule.registerQueue({
      name: PAYMENT_QUEUE_TOKEN,
      defaultJobOptions: bullmqDefaultJobOptions,
      forceDisconnectOnShutdown: true,
    }),
  ],
  providers: [
    { provide: OUTBOX_SERVICE, useClass: OutboxService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxRepository },
  ],
  exports: [OUTBOX_SERVICE, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
