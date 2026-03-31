import { RequestContext } from '@/shared/utils/request-context';
import { randomUUID } from 'crypto';

export abstract class BaseJobPayload {
  public readonly jobId: string = crypto.randomUUID();

  public readonly timestamp: string = new Date().toISOString();

  public readonly correlationId: string =
    RequestContext.getCorrelationId() ?? randomUUID();
}
