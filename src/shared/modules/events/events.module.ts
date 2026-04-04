import { Global, Module } from '@nestjs/common';
import { EventProcessor } from './processors/event.processor';
import { BullEventBus } from './implementations/bull-event-bus';
import { EVENT_BUS } from './constants/event-bus.token';
import { BullModule } from '@nestjs/bullmq';
import { bullmqDefaultJobOptions } from '../../../config/bullmq.config';
import { CacheModule } from '../../../modules/cache/cache.module';
import { NotifyUserJobStrategy } from './strategies';
import { EventJobHandlerFactory } from './factories/event-job-handler.factory';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'events',
      defaultJobOptions: bullmqDefaultJobOptions,
    }),
    CacheModule,
  ],
  providers: [
    {
      provide: EVENT_BUS,
      useClass: BullEventBus,
    },
    BullEventBus,
    EventProcessor,
    NotifyUserJobStrategy,
    EventJobHandlerFactory,
  ],
  exports: [EVENT_BUS],
})
export class EventsModule {}
