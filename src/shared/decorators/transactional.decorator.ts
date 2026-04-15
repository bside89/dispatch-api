/*eslint-disable @typescript-eslint/no-explicit-any */
import { InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionContext } from '../utils/transaction-context';
import { ensureError, template } from '../helpers/functions';
import { I18N_COMMON } from '../constants/i18n';

/**
 * A decorator that wraps a method in a TypeORM transaction.
 * The Service MUST have the dataSource injected for the decorator to work.
 * @returns A method decorator.
 */
export function Transactional() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      // 'this' refers to the Service instance
      // The Service MUST have the dataSource injected for the decorator to work
      const dataSource = this.dataSource as DataSource;
      if (!dataSource) {
        console.error(
          'DataSource not found in Service. Please inject DataSource as "protected readonly dataSource: DataSource".',
        );
        throw new InternalServerErrorException(
          template(I18N_COMMON.ERRORS.INTERNAL_SERVER_ERROR),
        );
      }

      return await dataSource.transaction(async (manager) => {
        return await TransactionContext.run(manager, async () => {
          try {
            return await originalMethod.apply(this, args);
          } catch (e) {
            const error = ensureError(e);
            // TypeORM will automatically roll back when it detects the thrown error
            throw error;
          }
        });
      });
    };

    return descriptor;
  };
}
