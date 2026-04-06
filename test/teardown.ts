/*eslint-disable @typescript-eslint/no-explicit-any */
export default async () => {
  console.log('\nStopping Testcontainers...');

  await (global as any).__POSTGRES_CONTAINER__.stop();
  await (global as any).__REDIS_CONTAINER__.stop();

  console.log('Containers stopped.');
};
