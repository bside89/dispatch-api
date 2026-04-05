import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { UserRepository } from '../users/repositories/user.repository';
import { HashUtils } from '@/shared/utils/hash.utils';
import { CACHE_CONFIG } from '@/shared/constants/cache-config.constant';
import { BaseService } from '@/shared/services/base.service';
import { OutboxService } from '@/shared/modules/outbox/outbox.service';
import { NotifyUserJobPayload } from '@/shared/modules/events/processors/payloads/notify-user.payload';
import { OutboxType } from '@/shared/modules/outbox/enums/outbox-type.enum';
import { UseLock } from '@/shared/decorators/lock.decorator';
import Redlock from 'redlock';
import type { RequestUser } from './interfaces/request-user.interface';
import { AUTH_KEY } from './constants/auth.key';

@Injectable()
export class AuthService extends BaseService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly userRepository: UserRepository,
    private readonly outboxService: OutboxService,
    protected readonly redlock: Redlock, // Used in @UseLock()
  ) {
    super(AuthService.name);
  }

  @UseLock({ prefix: 'auth-login', key: ([email]) => email })
  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOneCompleteWhere({ email });

    if (!user) throw new UnauthorizedException();

    const isValid = await HashUtils.compare(user.password, password);
    if (!isValid) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user);

    await this.updateRefreshToken(user.id, tokens.refreshToken);

    // Add to the Outbox for notifying the user about the login (Event Bus)
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

  @UseLock({ prefix: 'auth-refresh', key: ([reqUser]) => reqUser.jwtPayload.jti })
  async refresh(reqUser: RequestUser): Promise<LoginResponseDto> {
    const refreshToken = reqUser.jwtPayload.refreshToken;
    if (!refreshToken) throw new UnauthorizedException('No refresh token found');

    const user = await this.userRepository.findOneCompleteWhere({
      email: reqUser.jwtPayload.email,
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

  @UseLock({ prefix: 'auth-logout', key: ([reqUser]) => reqUser.jwtPayload.jti })
  async logout(reqUser: RequestUser): Promise<void> {
    await this.updateRefreshToken(reqUser.id, null);

    await this.cacheService.set(
      AUTH_KEY.BLACKLIST(reqUser.jwtPayload.jti),
      true,
      CACHE_CONFIG.AUTH_BLACKLIST_TTL,
    );
  }

  private async generateTokens(user: User): Promise<LoginResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
    };

    const accessTokenExpiry =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshTokenExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTokenExpiry as any,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry as any,
    });

    const result: LoginResponseDto = {
      accessToken,
      refreshToken,
    };

    return result;
  }

  @UseLock({ prefix: 'user-update', key: ([userId]) => userId })
  private async updateRefreshToken(
    userId: string,
    refreshToken?: string,
  ): Promise<void> {
    const hash = refreshToken ? await HashUtils.hash(refreshToken) : null;
    await this.userRepository.update(userId, { refreshToken: hash });
  }
}
