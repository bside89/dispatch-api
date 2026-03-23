import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from '../../user/user.service';
import { CacheService } from '../../cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.Refresh,
) {
  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const user = await this.userService.findOneComplete(payload.sub); // Retrieve refreshToken for potential future use

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.refreshToken) {
      throw new UnauthorizedException('No refresh token found');
    }

    return user; // This will be attached to req.user in controllers that use the JwtAuthGuard
  }
}
