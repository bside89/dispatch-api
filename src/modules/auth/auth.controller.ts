import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh.guard';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { BaseController } from '@/shared/controllers/base.controller';
import { LoginResponseDto } from './dto/login-response.dto';
import type { RequestUser } from './interfaces/request-user.interface';

@Controller({ path: 'v1/auth', version: '1' })
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super(AuthController.name);
  }

  @Post('login')
  @Public()
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
  async login(@Body() dto: LoginDto) {
    this.logger.debug('POST /auth/login - Attempting login', {
      userEmail: dto.email,
    });

    const result = await this.authService.login(dto.email, dto.password);

    return this.success(result, 'Login successful');
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
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
  async refresh(@GetUser() user: RequestUser) {
    this.logger.debug('POST /auth/refresh - Refreshing token', { userId: user.id });

    const result = await this.authService.refresh(user);

    return this.success(result, 'Token refreshed successfully');
  }

  @Post('logout')
  @ApiOperation({
    summary: 'User logout',
    description: 'Logs out a user and invalidates their refresh token.',
  })
  @ApiCreatedResponse({
    description: 'Logout successful',
  })
  async logout(@GetUser() user: RequestUser) {
    this.logger.debug('POST /auth/logout - Logging out user', { userId: user.id });

    await this.authService.logout(user);

    return this.success({}, 'Logout successful');
  }
}
