import { Logger } from '@nestjs/common';

type LogData = Record<string, unknown>;

/**
 * Wrapper around NestJS Logger that properly handles structured data with
 * nestjs-pino.
 */
export class AppLogger {
  private readonly nestLogger: Logger;

  constructor(context: string) {
    this.nestLogger = new Logger(context);
  }

  verbose(message: string, data?: LogData): void {
    data !== undefined
      ? this.nestLogger.verbose(data as any, message)
      : this.nestLogger.verbose(message);
  }

  debug(message: string, data?: LogData): void {
    data !== undefined
      ? this.nestLogger.debug(data as any, message)
      : this.nestLogger.debug(message);
  }

  log(message: string, data?: LogData): void {
    data !== undefined
      ? this.nestLogger.log(data as any, message)
      : this.nestLogger.log(message);
  }

  warn(message: string, data?: LogData): void {
    data !== undefined
      ? this.nestLogger.warn(data as any, message)
      : this.nestLogger.warn(message);
  }

  error(message: string, data?: LogData | Error): void {
    if (data instanceof Error) {
      this.nestLogger.error({ err: data } as any, message);
    } else if (data !== undefined) {
      this.nestLogger.error(data as any, message);
    } else {
      this.nestLogger.error(message);
    }
  }
}
