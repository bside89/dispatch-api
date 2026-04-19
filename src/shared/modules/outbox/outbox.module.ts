import { OutboxService } from './outbox.service';
import { Global, Module } from '@nestjs/common';
import { OutboxRepository } from './repositories/outbox.repository';
import { bullmqDefaultJobOptions } from '@/config/bullmq.config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from './entities/outbox.entity';
import { ORDER_QUEUE, PAYMENT_QUEUE } from '@/shared/constants/queues.token';
import { OUTBOX_SERVICE, OUTBOX_REPOSITORY } from './constants/outbox.token';

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
  ],
  providers: [
    { provide: OUTBOX_SERVICE, useClass: OutboxService },
    { provide: OUTBOX_REPOSITORY, useClass: OutboxRepository },
  ],
  exports: [OUTBOX_SERVICE, OUTBOX_REPOSITORY],
})
export class OutboxModule {}
