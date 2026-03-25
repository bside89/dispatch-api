import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export const loggerConfig = (configService: ConfigService) => {
  const isProduction = configService.get('NODE_ENV') === 'production';

  return {
    pinoHttp: {
      level: configService.get('LOG_LEVEL') || 'info',
      genReqId: () => randomUUID(),
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          headers: {
            host: req.headers.host,
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
          },
        }),
        res: (res) => ({
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
              messageFormat: '{req.method} {req.url} - {msg}',
            },
          },
    },
  };
};
