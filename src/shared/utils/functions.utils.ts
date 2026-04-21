/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppLogger } from './app-logger.utils';

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
  } catch (e) {
    const error = ensureError(e);
    const message = `Non-critical error ignored in ${context}: ${error.message}`;
    if (logger) {
      logger.warn(message);
    } else {
      console.warn(message);
    }
    return null;
  }
}

/**
 * Ensures that a value is an instance of Error. If the value is not an Error,
 * it attempts to convert it to an Error with a meaningful message.
 * @param value The value to ensure as an Error.
 * @returns An Error instance.
 */
export function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;

  let stringified = '[Unable to extract error message]';
  try {
    stringified = JSON.stringify(value);
  } catch {
    stringified = String(value);
  }

  return new Error(`Unexpected error: ${stringified}`);
}

/**
 * Creates a template object with a key and optional arguments. This is useful for
 * internationalization (i18n) where the key can be used to look up a localized
 * string and the arguments can be used to replace placeholders in the string.
 * @param key The key for the template.
 * @param args Optional arguments to replace placeholders in the template.
 * @returns An object containing the key and arguments.
 */
export const template = (key: string, args?: Record<string, any>) => ({
  key,
  args,
});
