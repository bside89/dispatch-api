import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { ICacheService } from '../../shared/modules/cache/interfaces/cache-service.interface';
import { CACHE_SERVICE } from '../../shared/modules/cache/constants/cache.token';
import type { IUserRepository } from '../users/interfaces/user-repository.interface';
import { USER_REPOSITORY } from '../users/constants/users.token';
import { HashUtils } from '@/shared/utils/hash.utils';
import { CACHE_TTL } from '@/shared/constants/cache-ttl.constant';
import type { IOutboxService } from '@/shared/modules/outbox/interfaces/outbox-service.interface';
import { OUTBOX_SERVICE } from '@/shared/modules/outbox/constants/outbox.token';
import { NotifyUserJobPayload } from '@/shared/payloads/side-effects-job.payload';
import type { RequestUser } from './interfaces/request-user.interface';
import { AUTH_KEY } from '../../shared/modules/cache/constants/auth.key';
import type ms from 'ms';
import { AuthMessageFactory } from './factories/auth-message.factory';
import { template } from '@/shared/helpers/functions';
import { I18N_AUTH, I18N_COMMON } from '@/shared/constants/i18n';
import { IAuthService } from './interfaces/auth-service.interface';
import { BaseService } from '@/shared/services/base.service';
import { DbGuardService } from '@/shared/modules/db-guard/db-guard.service';
import { LOCK_KEY } from '@/shared/constants/lock.key';

@Injectable()
export class AuthService extends BaseService implements IAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(OUTBOX_SERVICE) private readonly outboxService: IOutboxService,
    private readonly messages: AuthMessageFactory,
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

    const isValid = await HashUtils.compare(user.password, password);
    if (!isValid)
      throw new UnauthorizedException(template(I18N_AUTH.ERRORS.INVALID_PASSWORD));

    const result = await this.generateTokens(user);
    await this.updateRefreshToken(user.id, result.refreshToken);

    // Notify the user
    const message = await this.messages.notifications.login(
      user.language,
      user.name,
    );
    await this.outboxService.add(new NotifyUserJobPayload(user.id, message));

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

    const isValid = await HashUtils.compare(user.refreshToken, refreshToken);
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

    const result: LoginResponseDto = {
      accessToken,
      refreshToken,
      userId: user.id,
      language: user.language ?? 'en',
    };

    return result;
  }

  updateRefreshToken(userId: string, refreshToken?: string): Promise<void> {
    return this.guard.lock(LOCK_KEY.USER.UPDATE(userId), async () => {
      const hash = refreshToken ? await HashUtils.hash(refreshToken) : null;
      this.userRepository.update(userId, { refreshToken: hash });
    });
  }
}
