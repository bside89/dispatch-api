import { AsyncLocalStorage } from 'async_hooks';

interface RequestStore {
  correlationId: string;
}

export class RequestContext {
  private static storage = new AsyncLocalStorage<RequestStore>();

  static run(correlationId: string, fn: () => Promise<any>) {
    return this.storage.run({ correlationId }, fn);
  }

  static getCorrelationId(): string | undefined {
    return this.storage.getStore()?.correlationId;
  }
}
