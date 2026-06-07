import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { col } from '@/shared/utils/functions.utils';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCursorQueryDto } from '../../dto/user-cursor-query.dto';
import { User } from '../../entities/user.entity';
import { IUserRepository } from '../../interfaces/user-repository.interface';

const ALIAS_USER = 'user';
const user = col<User>(ALIAS_USER);

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class UserRepository extends BaseRepository<User> implements IUserRepository {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository);
  }

  async filter(query: UserCursorQueryDto): Promise<PagCursorResultDto<User>> {
    const { name, email, cursor } = query;
    const limit = cursor?.limit
      ? Math.min(cursor.limit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

    const queryBuilder = this.createQueryBuilder(ALIAS_USER)
      .orderBy(user('createdAt'), 'DESC')
      .addOrderBy(user('id'), 'DESC')
      .take(limit + 1);

    if (name) {
      queryBuilder.andWhere(`${user('name')} ILIKE :name`, { name: `%${name}%` });
    }
    if (email) {
      queryBuilder.andWhere(`${user('email')} ILIKE :email`, {
        email: `%${email}%`,
      });
    }
    if (cursor?.startingAfter) {
      queryBuilder.andWhere(`${user('createdAt')} < :startingAfter`, {
        startingAfter: cursor.startingAfter,
      });
    }

    const rows = await queryBuilder.getMany();
    const hasMore = rows.length > limit;
    const users = hasMore ? rows.slice(0, limit) : rows;
    const lastUser = users.at(-1);

    return new PagCursorResultDto(
      users,
      hasMore && lastUser ? this.encodeCursor(lastUser) : undefined,
      hasMore,
    );
  }

  private encodeCursor(u: User): string {
    return Buffer.from(
      JSON.stringify({ startingAfter: u.createdAt.toISOString() }),
    ).toString('base64');
  }
}
