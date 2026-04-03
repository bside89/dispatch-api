// Used in some places to simulate a network delay
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run some piece of code without throwing an error, and log the error if it happens
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
