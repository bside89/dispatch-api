import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JwtStrategyName.ACCESS) {
  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (this.configService.get('TEST_ENV') === 'true') {
      // In test environment, allow all requests to bypass authentication
      return true;
    }

    return super.canActivate(context);
  }
}
