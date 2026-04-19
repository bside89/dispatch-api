import { AuthGuard } from '@nestjs/passport';
import { JWT_REFRESH } from '../constants/jwt-name.token';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard(JWT_REFRESH) {}
