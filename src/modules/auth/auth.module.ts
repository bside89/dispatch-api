import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule.register({}), UsersModule],
  exports: [AuthService],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, UsersService],
})
export class AuthModule {}
