/* eslint-disable @typescript-eslint/no-explicit-any */
import { I18nService } from 'nestjs-i18n';

export abstract class BaseMessageFactory {
  constructor(protected readonly i18n: I18nService) {}

  protected async factory(
    templateKey: string,
    args?: Record<string, any>,
    language: string = 'en',
  ): Promise<string> {
    const message = await this.i18n.translate(templateKey, {
      lang: language,
      args: args,
    });
    return `${message}`;
  }
}
