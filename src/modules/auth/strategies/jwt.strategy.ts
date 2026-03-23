import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { CacheService } from '../../cache/cache.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Store in cache to avoid repeated database queries
    const cacheKey = `user_${payload.sub}`;
    let user = await this.cacheService.get(cacheKey);

    if (!user) {
      user = await this.userService.findOne(payload.sub);
      if (user) {
        await this.cacheService.set(cacheKey, user, 3600); // Cache for 1 hour
      }
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user; // This will be attached to req.user in controllers that use the JwtAuthGuard
  }
}
