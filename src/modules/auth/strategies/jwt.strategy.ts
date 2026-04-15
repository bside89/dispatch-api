import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { Request } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';
import { AUTH_KEY } from '../../../shared/modules/cache/constants/auth.key';
import { template } from '@/shared/helpers/functions';
import { I18N_AUTH } from '@/shared/constants/i18n';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JwtStrategyName.ACCESS) {
  constructor(
    configService: ConfigService,
    private readonly cacheService: CacheService,
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

    const user: RequestUser = {
      id: payload.sub,
      jwtPayload: payload,
    };

    return user; // Req.user
  }
}
