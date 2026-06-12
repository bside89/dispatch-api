import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';
import { NotificationEventToTemplateMapper } from '@/modules/notifications/helpers/notification-event-mapper.util';

@Injectable()
export class NotificationOutputFactory {
  constructor(private readonly i18nService: I18nService) {}

  async create(
    event: NotificationEvent,
    data: Record<string, any>,
    language?: string,
  ): Promise<{ title: string; message: string }> {
    const title = await this.translate({
      templateKey: NotificationEventToTemplateMapper.getTitleTemplate(event),
      args: data,
      language,
    });
    const message = await this.translate({
      templateKey: NotificationEventToTemplateMapper.getMessageTemplate(event),
      args: data,
      language,
    });

    return { title, message };
  }

  private async translate(parameters: {
    templateKey: string;
    args: Record<string, any>;
    language?: string;
  }): Promise<string> {
    const message = await this.i18nService.translate(parameters.templateKey, {
      lang: parameters.language || 'en',
      args: parameters.args,
    });
    return message as string;
  }
}
