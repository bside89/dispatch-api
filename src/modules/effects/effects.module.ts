import { Module } from '@nestjs/common';
import { EffectsProcessor } from '@/modules/effects/providers/processors/effects.processor';
import { NotifyUserJobStrategy } from './providers/strategies';
import { EffectJobHandlerFactory } from '@/modules/effects/providers/factories/effects-job-handler.factory';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [EffectsProcessor, NotifyUserJobStrategy, EffectJobHandlerFactory],
})
export class EffectsModule {}
