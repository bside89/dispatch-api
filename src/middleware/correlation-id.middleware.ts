import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { RequestContext } from '@/shared/utils/request-context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: IncomingMessage & { id?: string }, _res: ServerResponse, next: () => void) {
    // pino-http sets req.id via genReqId; fall back to headers or a fresh UUID
    const correlationId =
      req.id ||
      (req.headers['x-correlation-id'] as string) ||
      (req.headers['x-request-id'] as string) ||
      randomUUID();

    RequestContext.run(correlationId, () => Promise.resolve(next()));
  }
}
