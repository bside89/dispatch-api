// TypeORM's PostgresQueryRunner.loadTables() runs schema-inspection queries
// concurrently via Promise.all on a single pg Client during DataSource.synchronize().
// pg@8 emits a DeprecationWarning for this pattern; it is harmless and internal
// to TypeORM — there is nothing in our code to fix.
const _emitWarning = process.emitWarning.bind(process);
(process as NodeJS.Process).emitWarning = (
  warning: string | Error,
  ...args: unknown[]
) => {
  const msg =
    typeof warning === 'string' ? warning : ((warning as Error)?.message ?? '');
  if (
    msg.includes(
      'Calling client.query() when the client is already executing a query',
    )
  ) {
    return;
  }
  (_emitWarning as (...a: unknown[]) => void)(warning, ...args);
};
