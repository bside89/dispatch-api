import { AuthGuard } from '@nestjs/passport';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard(JwtStrategyName.REFRESH) {}
