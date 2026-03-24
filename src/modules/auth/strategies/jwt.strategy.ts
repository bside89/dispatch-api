import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { CacheService } from '../../cache/cache.service';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.Access,
) {
  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(payload: any) {
    // Store in cache to avoid repeated database queries
    const cacheKey = `user_${payload.sub}`;
    let user = await this.cacheService.get(cacheKey);

    if (!user) {
      user = await this.userService.findOneComplete(payload.sub); // Retrieve refreshToken for potential future use
      if (user) {
        await this.cacheService.set(cacheKey, user, 3600); // Cache for 1 hour
      } else {
        throw new UnauthorizedException('User not found');
      }
    }

    return user; // This will be attached to req.user in controllers that use the JwtAuthGuard
  }
}
