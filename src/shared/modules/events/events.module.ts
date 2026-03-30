import { Global, Module } from '@nestjs/common';
import { EventProcessor } from './processors/event.processor';
import { BullEventBus } from './implementations/bull-event-bus';
import { EVENT_BUS } from './constants/event-bus.token';
import { BullModule } from '@nestjs/bullmq';
import { bullmqDefaultJobOptions } from '../../../config/bullmq.config';
import { NotificationStrategy } from './strategies/notification.strategy';
import { CacheModule } from '../../../modules/cache/cache.module';

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
    NotificationStrategy,
  ],
  exports: [EVENT_BUS],
})
export class EventsModule {}
