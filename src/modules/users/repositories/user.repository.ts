import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserQueryDto } from '../dto/user-query.dto';
import { User } from '../entities/user.entity';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { PagOffsetResultDto } from '@/shared/dto/pag-offset-result.dto';
import { col } from '@/shared/utils/functions.utils';
import { IUserRepository } from '../interfaces/user-repository.interface';

const ALIAS_USER = 'user';
const user = col<User>(ALIAS_USER);

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }

  async filter(query: Partial<UserQueryDto>): Promise<PagOffsetResultDto<User>> {
    const queryBuilder = this.createQueryBuilder(ALIAS_USER);

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
        ([data, total]) => new PagOffsetResultDto(total, query.page, limit, data),
      );
  }
}
