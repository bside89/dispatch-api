import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CacheService } from '../../cache/cache.service';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.ACCESS,
) {
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
    // Check if the token's jti is blacklisted (i.e., revoked)
    const isBlacklisted = await this.cacheService.get(
      `blacklist:${payload.jti}`,
    );
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
