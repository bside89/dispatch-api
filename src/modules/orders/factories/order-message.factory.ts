import { I18N_ORDERS } from '@/shared/constants/i18n';
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
      this.create(I18N_ORDERS.RESPONSES.CREATE, undefined, language),
    findOne: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.FIND_ONE, undefined, language),
    update: async (language: string, status: OrderStatus) =>
      this.create(I18N_ORDERS.RESPONSES.UPDATE, { status }, language),
    remove: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.REMOVE, undefined, language),
    ship: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.SHIP, undefined, language),
    deliver: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.DELIVER, undefined, language),
    cancel: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.CANCEL, undefined, language),
    refund: async (language: string) =>
      this.create(I18N_ORDERS.RESPONSES.REFUND, undefined, language),
  };

  public notifications = {
    orderCreated: async (language: string, total: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_CREATED, { total }, language),
    orderUpdated: async (language: string, status: OrderStatus) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_UPDATED, { status }, language),
    orderPaid: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_PAID, undefined, language),
    orderProcessed: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_PROCESSED, undefined, language),
    orderShipped: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_SHIPPED, undefined, language),
    orderDelivered: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_DELIVERED, undefined, language),
    orderCanceled: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_CANCELED, undefined, language),
    orderRefunded: async (language: string) =>
      this.create(I18N_ORDERS.NOTIFICATIONS.ORDER_REFUNDED, undefined, language),
    orderProcessFailed: async (language: string) =>
      this.create(
        I18N_ORDERS.NOTIFICATIONS.ORDER_PROCESS_FAILED,
        undefined,
        language,
      ),
  };

  public errors = {
    orderNotFound: async (language: string) =>
      this.create(I18N_ORDERS.ERRORS.ORDER_NOT_FOUND, undefined, language),
    invalidOrderData: async (language: string) =>
      this.create(I18N_ORDERS.ERRORS.INVALID_ORDER_DATA, undefined, language),
    insufficientStock: async (language: string, itemName: string) =>
      this.create(I18N_ORDERS.ERRORS.INSUFFICIENT_STOCK, { itemName }, language),
    badPreconditions: async (
      language: string,
      status: OrderStatus,
      currentStatus: OrderStatus,
    ) =>
      this.create(
        I18N_ORDERS.ERRORS.BAD_PRECONDITIONS,
        { status, currentStatus },
        language,
      ),
  };
}
