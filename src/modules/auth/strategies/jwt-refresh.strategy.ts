import { PassportStrategy } from '@nestjs/passport';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Request } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JwtStrategyName.REFRESH,
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const authHeader = req.headers.authorization;

    payload.refreshToken = authHeader?.replace('Bearer', '').trim();

    const user: RequestUser = {
      id: payload.sub,
      jwtPayload: payload,
    };

    return user; // Req.user
  }
}
