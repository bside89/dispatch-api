import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppLogger } from '@/shared/utils/app-logger.utils';
import { RequestContext } from '@/shared/utils/request-context.utils';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new AppLogger(LoggingMiddleware.name);

  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = RequestContext.getCorrelationId();
    const endpoint = req.originalUrl.split('?')[0];

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    if (isProduction) {
      this.logger.log(
        `${req.method} ${endpoint} [${correlationId}] - request initiated`,
      );
    } else {
      this.logger.log('request initiated', {
        method: req.method,
        endpoint,
        correlationId,
        body: req.body,
        query: req.query,
        params: req.params,
      });
    }

    next();
  }
}
