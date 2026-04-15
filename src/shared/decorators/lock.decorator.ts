/*eslint-disable @typescript-eslint/no-explicit-any */
import { InternalServerErrorException } from '@nestjs/common';
import Redlock from 'redlock';
import { CACHE_TTL } from '../constants/cache-ttl.constant';
import { I18N_COMMON } from '../constants/i18n';
import { template } from '../helpers/functions';

export type UseLockKeySelector<T = any> = (args: T) => string | number;

export interface UseLockOptions {
  prefix: string;

  key: UseLockKeySelector;

  ttl?: number;
}

/**
 * A decorator that acquires a distributed lock using Redlock before executing the
 * method. The Service MUST have the redlock injected for the decorator to work.
 * @param param0 The options for the lock, including prefix, key selector, and TTL.
 * @returns A method decorator.
 */
export function UseLock({ ttl = CACHE_TTL.LOCK, prefix, key }: UseLockOptions) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      // 'this' refers to the Service instance
      // The Service MUST have the redlock injected for the decorator to work
      const redlock = this.redlock as Redlock;
      if (!redlock) {
        console.error(
          'Redlock not found in class instance. Please inject Redlock as "protected readonly redlock: Redlock".',
        );
        throw new InternalServerErrorException(
          template(I18N_COMMON.ERRORS.INTERNAL_SERVER_ERROR),
        );
      }

      const keyValue = key(args);
      const resourceKey = `${prefix}:${keyValue}`;

      const lock = await redlock.acquire([resourceKey], ttl);
      try {
        return await originalMethod.apply(this, args);
      } finally {
        await redlock.release(lock);
      }
    };

    return descriptor;
  };
}
