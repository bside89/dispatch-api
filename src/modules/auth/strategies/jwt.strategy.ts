import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { Request } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';

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
      `blacklist:auth:${payload.jti}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const user: RequestUser = {
      id: payload.sub,
      jwtPayload: payload,
    };

    return user; // Req.user
  }
}
