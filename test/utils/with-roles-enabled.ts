/**
 * Temporarily disables the test-environment bypass in RolesGuard
 * (sets TEST_ENV='false') for the duration of the callback, then restores
 * the original value — even if the callback throws.
 */
export async function withRolesEnabled(fn: () => Promise<void>): Promise<void> {
  const originalTestEnv = process.env.TEST_ENV;
  process.env.TEST_ENV = 'false';
  try {
    await fn();
  } finally {
    process.env.TEST_ENV = originalTestEnv;
  }
}
