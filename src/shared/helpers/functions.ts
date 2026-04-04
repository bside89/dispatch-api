/**
 * Delays the execution for a specified amount of time.
 * @param ms Time to wait in milliseconds.
 * @returns A promise that resolves after the specified delay.
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a function and ignores any errors that occur, logging them instead.
 * @param fn The function to run.
 * @param context A description of the context in which the function is run, used for logging.
 * @returns The result of the function, or null if an error occurred.
 */
export async function runAndIgnoreError<T>(
  fn: () => Promise<T>,
  context: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    console.warn(`Non-critical error ignored in ${context}: ${error.message}`);
    return null;
  }
}
