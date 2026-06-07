import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { UserCursorQueryDto } from '../dto/user-cursor-query.dto';
import { User } from '../entities/user.entity';

export interface IUserRepository extends IBaseRepository<User> {
  filter(query: UserCursorQueryDto): Promise<PagCursorResultDto<User>>;
}
