import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JWT_ACCESS } from '../constants/jwt-name.token';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.token';
import type { ICacheService } from '../../../shared/modules/cache/interfaces/cache-service.interface';
import { Request } from 'express';
import { AUTH_KEY } from '../../../shared/modules/cache/constants/auth.key';
import { template } from '@/shared/utils/functions.utils';
import { I18N_AUTH } from '@/shared/constants/i18n';
import { jwtToRequestUser } from '../helpers/auth-functions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_ACCESS) {
  constructor(
    configService: ConfigService,
    @Inject(CACHE_SERVICE) private readonly cacheService: ICacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
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
    return jwtToRequestUser(payload); // Req.user
  }
}
