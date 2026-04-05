import { AppLogger } from '../utils/app-logger';

/**
 * Delays the execution for a specified amount of time.
 * @param ms Time to wait in milliseconds.
 * @returns A promise that resolves after the specified delay.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns a function that produces a type-safe "alias.column" string for use in
 * TypeORM QueryBuilder methods. The key is validated by TypeScript at compile time.
 *
 * @example
 * const order = col<Order>('order');
 * queryBuilder.orderBy(order('createdAt'), 'DESC');
 */
export function col<T>(alias: string) {
  return (key: keyof T): string => `${alias}.${String(key)}`;
}

/**
 * Runs a function and ignores any errors that occur, logging them instead.
 * @param fn The function to run.
 * @param context A description of the context in which the function is run, used for
 * logging.
 * @param logger An optional logger to use for logging warnings. If not provided, it
 * will default to using console.warn.
 * @returns The result of the function, or null if an error occurred.
 */
export async function runAndIgnoreError<T>(
  fn: () => Promise<T>,
  context: string,
  logger?: Pick<AppLogger, 'warn'>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    const message = `Non-critical error ignored in ${context}: ${error.message}`;
    logger ? logger.warn(message) : console.warn(message);
    return null;
  }
}
