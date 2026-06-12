import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import { I18N_AUTH, I18N_COMMON } from '@/shared/constants/i18n';
import { LOCK_KEY } from '@/shared/constants/lock.key';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { NotifyUserJobPayload } from '@/shared/payloads/effects-job.payload';
import { BaseService } from '@/shared/providers/services/base.service';
import { template } from '@/shared/utils/functions.utils';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type ms from 'ms';
import { AUTH_KEY } from '@/shared/modules/cache/constants/auth.key';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { USER_REPOSITORY } from '../users/constants/users.token';
import { User } from '../users/entities/user.entity';
import type { IUserRepository } from '../users/interfaces/user-repository.interface';
import { LoginResponseDto } from './dto/login-response.dto';
import { IAuthService } from './interfaces/auth-service.interface';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { RequestUser } from './interfaces/request-user.interface';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { NotificationEvent } from '@/modules/notifications/enums/notification-event.enum';

@Injectable()
export class AuthService extends BaseService implements IAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    private readonly guard: DbGuardService,
  ) {
    super(AuthService.name);
  }

  login(email: string, password: string): Promise<LoginResponseDto> {
    return this.guard.lockAndTransaction<LoginResponseDto>(
      LOCK_KEY.AUTH.LOGIN(email),
      () => this._login(email, password),
    );
  }

  private async _login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user)
      throw new UnauthorizedException(
        template(I18N_COMMON.ERRORS.USER_NOT_FOUND, { email }),
      );

    const isValid = await HashAdapter.compare(user.password, password);
    if (!isValid)
      throw new UnauthorizedException(template(I18N_AUTH.ERRORS.INVALID_PASSWORD));

    const result = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, result.refreshToken);

    // Notify the user
    await this.outboxService.add(
      new NotifyUserJobPayload(
        user.id,
        NotificationType.PUSH,
        NotificationEvent.AUTH_LOGIN,
      ),
    );

    return result;
  }

  refresh(reqUser: RequestUser): Promise<LoginResponseDto> {
    return this.guard.lockAndTransaction<LoginResponseDto>(
      LOCK_KEY.AUTH.REFRESH(reqUser.email),
      () => this._refresh(reqUser),
    );
  }

  private async _refresh(reqUser: RequestUser): Promise<LoginResponseDto> {
    const refreshToken = reqUser.jwt.refreshToken;
    if (!refreshToken)
      throw new UnauthorizedException(template(I18N_AUTH.ERRORS.NO_REFRESH_TOKEN));

    const user = await this.userRepository.findOne({
      where: { email: reqUser.email },
    });
    if (!user)
      throw new UnauthorizedException(
        template(I18N_COMMON.ERRORS.USER_NOT_FOUND, {
          email: reqUser.email,
        }),
      );

    const isValid = await HashAdapter.compare(user.refreshToken, refreshToken);
    if (!isValid) {
      await this.logout(reqUser);
      throw new UnauthorizedException(
        template(I18N_AUTH.ERRORS.INVALID_REFRESH_TOKEN),
      );
    }

    const result = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, result.refreshToken);

    return result;
  }

  logout(reqUser: RequestUser): Promise<void> {
    return this.guard.lockAndTransaction<void>(
      LOCK_KEY.AUTH.LOGOUT(reqUser.email),
      () => this._logout(reqUser),
    );
  }

  private async _logout(reqUser: RequestUser): Promise<void> {
    await this.updateRefreshToken(reqUser.id, null);

    await this.cacheService.set(
      AUTH_KEY.BLACKLIST(reqUser.jwt.jti),
      true,
      CACHE_TTL.AUTH_BLACKLIST,
    );
  }

  private async generateTokens(user: User): Promise<LoginResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      language: user.language ?? 'en',
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

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      language: user.language ?? 'en',
    };
  }

  updateRefreshToken(userId: string, refreshToken?: string): Promise<void> {
    return this.guard.lock(LOCK_KEY.USER.UPDATE(userId), async () => {
      const hash = refreshToken ? await HashAdapter.hash(refreshToken) : null;
      await this.userRepository.update(userId, { refreshToken: hash });
    });
  }
}
