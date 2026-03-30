import { OutboxService } from './outbox.service';
import { Global, Module } from '@nestjs/common';
import { OutboxProcessor } from './processors/outbox.processor';
import { OutboxRepository } from './repositories/outbox.repository';
import { bullmqDefaultJobOptions } from '@/config/bullmq.config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outbox } from './entities/outbox.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Outbox]),
    BullModule.registerQueue({
      name: 'orders',
      defaultJobOptions: bullmqDefaultJobOptions,
    }),
  ],
  providers: [OutboxService, OutboxProcessor, OutboxRepository],
  exports: [OutboxService, OutboxRepository, OutboxProcessor],
})
export class OutboxModule {}
