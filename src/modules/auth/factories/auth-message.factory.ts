import { I18N_AUTH } from '@/shared/constants/i18n';
import { BaseMessageFactory } from '@/shared/factories/base-message.factory';
import { Injectable } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AuthMessageFactory extends BaseMessageFactory {
  constructor(i18n: I18nService) {
    super(i18n);
  }

  public responses = {
    login: async (language: string) =>
      this.factory(I18N_AUTH.RESPONSES.LOGIN, undefined, language),
    refresh: async (language: string) =>
      this.factory(I18N_AUTH.RESPONSES.REFRESH, undefined, language),
    logout: async (language: string) =>
      this.factory(I18N_AUTH.RESPONSES.LOGOUT, undefined, language),
  };

  public notifications = {
    login: async (language: string, userName: string) =>
      this.factory(I18N_AUTH.NOTIFICATIONS.LOGIN, { userName }, language),
  };

  public errors = {
    invalidRefreshToken: async (language: string) =>
      this.factory(I18N_AUTH.ERRORS.INVALID_REFRESH_TOKEN, undefined, language),
    invalidPassword: async (language: string) =>
      this.factory(I18N_AUTH.ERRORS.INVALID_PASSWORD, undefined, language),
  };
}
