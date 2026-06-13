import { CursorParams } from '../types/cursor-params.type';

export abstract class BaseCursorQueryDto {
  cursor?: CursorParams;
}
