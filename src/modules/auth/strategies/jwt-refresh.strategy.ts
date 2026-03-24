import { PassportStrategy } from '@nestjs/passport';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.Refresh,
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // Para pegarmos o token bruto depois
    });
  }

  async validate(req: any, payload: any) {
    const refreshToken = req.get('Authorization').replace('Bearer', '').trim();
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
