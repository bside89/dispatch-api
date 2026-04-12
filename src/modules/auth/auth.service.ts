import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { UserRepository } from '../users/repositories/user.repository';
import { HashUtils } from '@/shared/utils/hash.utils';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { NotifyUserJobPayload } from '@/shared/payloads/event-job.payload';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import type { RequestUser } from './interfaces/request-user.interface';
import { AUTH_KEY } from '../../shared/modules/cache/constants/auth.key';
import type ms from 'ms';
import { LOCK_PREFIX } from '@/shared/constants/lock-prefix.constants';
import { DataSource } from 'typeorm';
import { Transactional } from '@/shared/decorators/transactional.decorator';
import { TransactionalService } from '@/shared/services/transactional.service';

@Injectable()
export class AuthService extends TransactionalService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly outboxService: OutboxService,
    protected readonly dataSource: DataSource,
    protected readonly redlock: Redlock,
  ) {
    super(AuthService.name, dataSource, redlock);
  }

  @Transactional()
  @UseLock({ prefix: LOCK_PREFIX.AUTH.LOGIN, key: ([email]) => email })
  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await HashUtils.compare(user.password, password);
    if (!isValid) throw new UnauthorizedException('Invalid password');

    const tokens = await this.generateTokens(user);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Add to the outbox for notifying the user about the login (Event Bus)
    await this.outboxService.add(
      OutboxType.EVENTS_NOTIFY_USER,
      new NotifyUserJobPayload(
        user.id,
        user.name,
        `<To user ${user.name}>: Welcome! You have logged in successfully.`,
      ),
    );

    return tokens;
  }

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.AUTH.REFRESH,
    key: ([reqUser]) => reqUser.jwtPayload.jti,
  })
  async refresh(reqUser: RequestUser): Promise<LoginResponseDto> {
    const refreshToken = reqUser.jwtPayload.refreshToken;
    if (!refreshToken) throw new UnauthorizedException('No refresh token found');

    const user = await this.userRepository.findOne({
      where: { email: reqUser.jwtPayload.email },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await HashUtils.compare(user.refreshToken, refreshToken);
    if (!isValid) {
      await this.logout(reqUser);
      throw new UnauthorizedException(
        'Invalid refresh token. User logged out. Please log in again.',
      );
    }
    const tokens = await this.generateTokens(user);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  @Transactional()
  @UseLock({
    prefix: LOCK_PREFIX.AUTH.LOGOUT,
    key: ([reqUser]) => reqUser.jwtPayload.jti,
  })
  async logout(reqUser: RequestUser): Promise<void> {
    await this.updateRefreshToken(reqUser.id, null);

    await this.cacheService.set(
      AUTH_KEY.BLACKLIST(reqUser.jwtPayload.jti),
      true,
      CACHE_TTL.AUTH_BLACKLIST,
    );
  }

  private async generateTokens(user: User): Promise<LoginResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
    };

    const accessTokenExpiry = (this.configService.get('JWT_ACCESS_EXPIRES_IN') ??
      '15m') as ms.StringValue;
    const refreshTokenExpiry = (this.configService.get('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as ms.StringValue;

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTokenExpiry,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry,
    });

    const result: LoginResponseDto = {
      accessToken,
      refreshToken,
      userId: user.id,
    };

    return result;
  }

  @UseLock({ prefix: LOCK_PREFIX.USER.UPDATE, key: ([userId]) => userId })
  private async updateRefreshToken(
    userId: string,
    refreshToken?: string,
  ): Promise<void> {
    const hash = refreshToken ? await HashUtils.hash(refreshToken) : null;
    await this.userRepository.update(userId, { refreshToken: hash });
  }
}
