import { SuccessResponseDto } from '../dto/success-response.dto';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';
import { AppLogger } from '../utils/app-logger';

export abstract class BaseController {
  protected readonly logger: AppLogger;

  constructor(controllerName: string) {
    this.logger = new AppLogger(controllerName);
  }

  protected success<T>(
    data: T,
    message = 'Operation successful',
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
