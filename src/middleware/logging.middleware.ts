import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLogger } from '@/shared/utils/app-logger';
import { RequestContext } from '@/shared/utils/request-context';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new AppLogger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = RequestContext.getCorrelationId();
    const endpoint = req.originalUrl.split('?')[0];

    this.logger.debug(`${req.method} ${endpoint}`, {
      correlationId,
    });

    next();
  }
}
