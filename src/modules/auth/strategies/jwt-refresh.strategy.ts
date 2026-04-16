import { PassportStrategy } from '@nestjs/passport';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Request } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';
import { AUTH_KEY } from '@/shared/modules/cache/constants/auth.key';
import { CacheService } from '@/shared/modules/cache/cache.service';
import { I18N_AUTH } from '@/shared/constants/i18n';
import { template } from '@/shared/helpers/functions';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.REFRESH,
) {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
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

    const user: RequestUser = {
      id: payload.sub,
      jwtPayload: payload,
    };

    return user; // Req.user
  }
}
