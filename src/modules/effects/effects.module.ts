import { Module } from '@nestjs/common';
import { EffectsProcessor } from './processors/effects.processor';
import { NotifyUserJobStrategy } from './strategies';
import { EffectJobHandlerFactory } from './factories/effects-job-handler.factory';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [EffectsProcessor, NotifyUserJobStrategy, EffectJobHandlerFactory],
})
export class EffectsModule {}
