import { I18N_ITEM } from '@/shared/constants/i18n';
import { BaseMessageFactory } from '@/shared/factories/base-message.factory';
import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class ItemMessageFactory extends BaseMessageFactory {
  constructor(i18n: I18nService) {
    super(i18n);
  }

  public responses = {
    create: async (language: string) =>
      this.factory(I18N_ITEM.RESPONSES.CREATED, undefined, language),
    findOne: async (language: string) =>
      this.factory(I18N_ITEM.RESPONSES.RETRIEVED, undefined, language),
    update: async (language: string) =>
      this.factory(I18N_ITEM.RESPONSES.UPDATED, undefined, language),
    remove: async (language: string) =>
      this.factory(I18N_ITEM.RESPONSES.DELETED, undefined, language),
  };
}
