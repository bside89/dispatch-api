import { RequestContext } from '@/shared/utils/request-context.utils';
import { randomUUID } from 'crypto';

export abstract class BaseJobPayload {
  public readonly timestamp: string = new Date().toISOString();

  public readonly correlationId: string =
    RequestContext.getCorrelationId() ?? randomUUID();
}
