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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message || exception.message
        : 'Erro interno do servidor';

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
