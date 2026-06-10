import { I18N_COMMON } from '@/shared/constants/i18n';
import { template } from '@/shared/utils/functions.utils';
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { CursorQueryDto } from '../../dto/cursor-query.dto';

@Injectable()
export class CursorParamsPipe implements PipeTransform<
  string | undefined,
  CursorQueryDto | undefined
> {
  transform(value: string | undefined): CursorQueryDto | undefined {
    if (!value) {
      return undefined;
    }

    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const parsedCursor = JSON.parse(decoded) as Partial<CursorQueryDto>;

    if (!parsedCursor.startingAfter) {
      throw new BadRequestException(template(I18N_COMMON.ERRORS.INVALID_CURSOR));
    }

    return {
      startingAfter: parsedCursor.startingAfter,
      limit: parsedCursor.limit,
    };
  }
}
