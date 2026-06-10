import { JwtRefreshStrategy } from '@/modules/auth/providers/strategies/jwt-refresh.strategy';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from '@/modules/auth/providers/strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthMessageFactory } from '@/modules/auth/providers/factories/auth-message.factory';
import { AUTH_SERVICE } from './constants/auth.token';

@Module({
  imports: [JwtModule.register({}), UsersModule],
  exports: [AUTH_SERVICE],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_SERVICE, useClass: AuthService },
    AuthMessageFactory,
    JwtStrategy,
    JwtRefreshStrategy,
  ],
})
export class AuthModule {}
