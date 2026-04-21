import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Request } from 'express';
import { AUTH_KEY } from '@/shared/modules/cache/constants/auth.key';
import { CACHE_SERVICE } from '@/shared/modules/cache/constants/cache.token';
import type { ICacheService } from '@/shared/modules/cache/interfaces/cache-service.interface';
import { I18N_AUTH } from '@/shared/constants/i18n';
import { template } from '@/shared/helpers/functions';
import { jwtToRequestUser } from '../helpers/auth-functions';
import { JWT_REFRESH } from '../constants/jwt-name.token';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, JWT_REFRESH) {
  constructor(
    configService: ConfigService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const isBlacklisted = await this.cacheService.get(
      AUTH_KEY.BLACKLIST(payload.jti),
    );
    if (isBlacklisted) {
      throw new UnauthorizedException(template(I18N_AUTH.ERRORS.TOKEN_REVOKED));
    }
    const authHeader = req.headers.authorization;
    payload.refreshToken = authHeader?.replace('Bearer', '').trim();
    return jwtToRequestUser(payload); // Req.user
  }
}
