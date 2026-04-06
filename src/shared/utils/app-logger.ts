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
    if (data !== undefined) {
      this.nestLogger.verbose(data, message);
    } else {
      this.nestLogger.verbose(message);
    }
  }

  debug(message: string, data?: LogData): void {
    if (data !== undefined) {
      this.nestLogger.debug(data, message);
    } else {
      this.nestLogger.debug(message);
    }
  }

  log(message: string, data?: LogData): void {
    if (data !== undefined) {
      this.nestLogger.log(data, message);
    } else {
      this.nestLogger.log(message);
    }
  }

  warn(message: string, data?: LogData): void {
    if (data !== undefined) {
      this.nestLogger.warn(data, message);
    } else {
      this.nestLogger.warn(message);
    }
  }

  error(message: string, data?: LogData | Error): void {
    if (data instanceof Error) {
      this.nestLogger.error({ err: data }, message);
    } else if (data !== undefined) {
      this.nestLogger.error(data, message);
    } else {
      this.nestLogger.error(message);
    }
  }
}
