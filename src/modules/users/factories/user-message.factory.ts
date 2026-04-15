import { I18N_COMMON } from '@/shared/constants/i18n';
import { I18N_USERS } from '@/shared/constants/i18n/users.tokens';
import { BaseMessageFactory } from '@/shared/factories/base-message.factory';
import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class UserMessageFactory extends BaseMessageFactory {
  constructor(i18n: I18nService) {
    super(i18n);
  }

  public responses = {
    create: async (language: string) =>
      this.factory(I18N_USERS.RESPONSES.CREATED, undefined, language),
    findOne: async (language: string) =>
      this.factory(I18N_USERS.RESPONSES.RETRIEVED, undefined, language),
    update: async (language: string) =>
      this.factory(I18N_USERS.RESPONSES.UPDATED, undefined, language),
    updateLogin: async (language: string) =>
      this.factory(I18N_USERS.RESPONSES.LOGIN_UPDATED, undefined, language),
    remove: async (language: string) =>
      this.factory(I18N_USERS.RESPONSES.DELETED, undefined, language),
  };

  public errors = {
    userNotFound: async (language: string) =>
      this.factory(I18N_COMMON.ERRORS.USER_NOT_FOUND, undefined, language),
  };
}
