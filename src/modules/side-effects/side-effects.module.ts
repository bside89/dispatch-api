import { Module } from '@nestjs/common';
import { SideEffectsProcessor } from './processors/side-effects.processor';
import { NotifyUserJobStrategy } from './strategies';
import { SideEffectJobHandlerFactory } from './factories/side-effects-job-handler.factory';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [
    SideEffectsProcessor,
    NotifyUserJobStrategy,
    SideEffectJobHandlerFactory,
  ],
})
export class SideEffectsModule {}
