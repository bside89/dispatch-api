import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserQueryDto } from '../dto/user-query.dto';
import { User } from '../entities/user.entity';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { PaginatedResultDto } from '@/shared/dto/paginated-result.dto';
import { col } from '@/shared/helpers/functions';

const aliasUser = 'user';
const user = col<User>(aliasUser);

@Injectable()
export class UserRepository extends BaseRepository<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }

  async filter(query: Partial<UserQueryDto>): Promise<PaginatedResultDto<User>> {
    const queryBuilder = this.createQueryBuilder(aliasUser);

    queryBuilder.where(`${user('deactivated')} = :deactivated`, {
      deactivated: false,
    });
    if (query.name) {
      queryBuilder.andWhere(`${user('name')} ILIKE :name`, {
        name: `%${query.name}%`,
      });
    }
    if (query.email) {
      queryBuilder.andWhere(`${user('email')} ILIKE :email`, {
        email: `%${query.email}%`,
      });
    }

    // Apply pagination
    const limit = query.limit ? Math.min(query.limit, 100) : 20;
    const skip = (query.page - 1) * limit;

    return queryBuilder
      .skip(skip)
      .take(limit)
      .orderBy(user('createdAt'), 'DESC')
      .getManyAndCount()
      .then(
        ([data, total]) => new PaginatedResultDto(total, query.page, limit, data),
      );
  }
}
