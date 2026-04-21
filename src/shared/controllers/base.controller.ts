import { SuccessResponseDto } from '../dto/success-response.dto';
import { PagOffsetResponseDto } from '../dto/pag-offset-response.dto';
import { AppLogger } from '../utils/app-logger.utils';
import { PagOffsetResultDto } from '../dto/pag-offset-result.dto';
import { PagCursorResponseDto } from '../dto/pag-cursor-response.dto';
import { PagCursorResultDto } from '../dto/pag-cursor-result.dto';

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

  protected paginateOffset<T>(
    resultDto: PagOffsetResultDto<T>,
  ): PagOffsetResponseDto<T> {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...resultDto,
    };
  }

  protected paginateCursor<T>(
    resultDto: PagCursorResultDto<T>,
  ): PagCursorResponseDto<T> {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...resultDto,
    };
  }
}
