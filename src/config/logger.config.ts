import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { Params } from 'nestjs-pino';
import { RequestContext } from '@/shared/utils/request-context.utils';

export const loggerConfig = (configService: ConfigService): Params => {
  const isProduction = configService.get('NODE_ENV') === 'production';

  return {
    pinoHttp: {
      level: configService.get('LOG_LEVEL') || 'info',

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const correlationId =
          (req.headers['x-correlation-id'] as string) ||
          (req.headers['x-request-id'] as string) ||
          randomUUID();
        res.setHeader('x-correlation-id', correlationId);
        return correlationId;
      },

      mixin: () => {
        const correlationId = RequestContext.getCorrelationId();
        return correlationId ? { correlationId } : {};
      },

      serializers: {
        req: (req: IncomingMessage) => ({
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers.host,
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
          },
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
      },

      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              messageFormat: '{req.method} {req.url} [{correlationId}] - {msg}',
            },
          },
    },
  };
};
