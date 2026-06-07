import { GetUser } from '@/shared/decorators/get-user.decorator';
import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { resolveThrottleLimit } from '../../config/throttle.config';
import { AUTH_SERVICE } from './constants/auth.token';
import { Public } from './decorators/public.decorator';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh.guard';
import type { IAuthService } from './interfaces/auth-service.interface';
import type { RequestUser } from './interfaces/request-user.interface';

@Controller({ path: 'v1/auth', version: '1' })
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authService: IAuthService) {}

  @Post('login')
  @Public()
  @Throttle({ default: { limit: resolveThrottleLimit(5) } })
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates a user and returns access and refresh tokens. ' +
      'Requires email and password.',
  })
  @ApiCreatedResponse({
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or password',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Login credentials',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @Throttle({ default: { limit: resolveThrottleLimit(20) } })
  @ApiOperation({
    summary: 'Refresh token',
    description: 'Refreshes the access token using a valid refresh token.',
  })
  @ApiCreatedResponse({
    description: 'Token refreshed successfully',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid refresh token',
  })
  refresh(@GetUser() user: RequestUser) {
    return this.authService.refresh(user);
  }

  @Post('logout')
  @Throttle({ default: { limit: resolveThrottleLimit(20) } })
  @ApiOperation({
    summary: 'User logout',
    description: 'Logs out a user and invalidates their refresh token.',
  })
  @ApiCreatedResponse({
    description: 'Logout successful',
  })
  async logout(@GetUser() user: RequestUser) {
    await this.authService.logout(user);
  }
}
