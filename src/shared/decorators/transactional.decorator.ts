import { InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionContext } from '../utils/transaction-context';

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
        throw new InternalServerErrorException(
          'DataSource not found in Service. Please inject DataSource as "protected readonly dataSource: DataSource".',
        );
      }

      return await dataSource.transaction(async (manager) => {
        return await TransactionContext.run(manager, async () => {
          try {
            return await originalMethod.apply(this, args);
          } catch (error) {
            // TypeORM will automatically roll back when it detects the thrown error
            throw error;
          }
        });
      });
    };

    return descriptor;
  };
}
