import { I18N_ORDER } from '@/shared/constants/i18n';
import { BaseMessageFactory } from '@/shared/factories/base-message.factory';
import { I18nService } from 'nestjs-i18n';
import { OrderStatus } from '../enums/order-status.enum';
import { Injectable } from '@nestjs/common';

@Injectable()
export class OrderMessageFactory extends BaseMessageFactory {
  constructor(i18n: I18nService) {
    super(i18n);
  }

  public responses = {
    create: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.CREATE, undefined, language),
    findOne: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.FIND_ONE, undefined, language),
    update: async (language: string, status: OrderStatus) =>
      this.factory(I18N_ORDER.RESPONSES.UPDATE, { status }, language),
    remove: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.REMOVE, undefined, language),
    ship: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.SHIP, undefined, language),
    deliver: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.DELIVER, undefined, language),
    cancel: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.CANCEL, undefined, language),
    refund: async (language: string) =>
      this.factory(I18N_ORDER.RESPONSES.REFUND, undefined, language),
  };

  public notifications = {
    orderCreated: async (language: string, total: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_CREATED, { total }, language),
    orderUpdated: async (language: string, status: OrderStatus) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_UPDATED, { status }, language),
    orderPaid: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_PAID, undefined, language),
    orderProcessed: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_PROCESSED, undefined, language),
    orderShipped: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_SHIPPED, undefined, language),
    orderDelivered: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_DELIVERED, undefined, language),
    orderCanceled: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_CANCELED, undefined, language),
    orderRefunded: async (language: string) =>
      this.factory(I18N_ORDER.NOTIFICATIONS.ORDER_REFUNDED, undefined, language),
    orderProcessFailed: async (language: string) =>
      this.factory(
        I18N_ORDER.NOTIFICATIONS.ORDER_PROCESS_FAILED,
        undefined,
        language,
      ),
  };

  public errors = {
    orderNotFound: async (language: string) =>
      this.factory(I18N_ORDER.ERRORS.ORDER_NOT_FOUND, undefined, language),
    invalidOrderData: async (language: string) =>
      this.factory(I18N_ORDER.ERRORS.INVALID_ORDER_DATA, undefined, language),
    insufficientStock: async (language: string, itemName: string) =>
      this.factory(I18N_ORDER.ERRORS.INSUFFICIENT_STOCK, { itemName }, language),
    badPreconditions: async (
      language: string,
      status: OrderStatus,
      currentStatus: OrderStatus,
    ) =>
      this.factory(
        I18N_ORDER.ERRORS.BAD_PRECONDITIONS,
        { status, currentStatus },
        language,
      ),
  };
}
