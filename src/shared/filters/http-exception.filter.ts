/*eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';
import { I18nContext } from 'nestjs-i18n';
import { I18N_COMMON } from '../constants/i18n';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const exceptionResponse: any = exception.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const i18n = I18nContext.current();

    let message = 'Internal server error';
    if (exceptionResponse.key) {
      // Use I18nContext to translate the message
      message = i18n.translate(exceptionResponse.key, {
        args: exceptionResponse.args,
      });
    } else if (exception instanceof HttpException) {
      message = exceptionResponse.message || exception.message;
    } else {
      if (i18n) {
        message = i18n.translate(I18N_COMMON.ERRORS.INTERNAL_SERVER_ERROR);
      }
    }

    this.logger.error(
      `HTTP Status: ${status} Error: ${JSON.stringify(message)} Path: ${request.url}`,
      exception instanceof Error ? exception.stack : '',
    );

    const errorResponse: ErrorResponseDto = {
      success: false,
      message: Array.isArray(message) ? message[0] : message, // Class-Validator errors can be arrays
      error: exception instanceof Error ? exception.name : 'Error',
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
