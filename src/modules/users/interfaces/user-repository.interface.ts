import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { User } from '../entities/user.entity';
import { UserQueryDto } from '../dto/user-query.dto';

export interface IUserRepository extends IBaseRepository<User> {
  filter(query: Partial<UserQueryDto>): Promise<PaginatedResultDto<User>>;
}
