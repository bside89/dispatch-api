import { Logger } from '@nestjs/common';
import { SuccessResponseDto } from '../dto/success-response.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

export abstract class BaseController {
  protected readonly logger: Logger;

  constructor(protected readonly controllerName: string) {
    this.logger = new Logger(controllerName);
  }

  protected success<T>(
    data: T,
    message = 'Opperation successful',
  ): SuccessResponseDto<T> {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  protected paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    return {
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
