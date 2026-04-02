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
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { BaseController } from '@/shared/controllers/base.controller';
import { SuccessResponseDto } from '@/shared/dto/success-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';

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
      'Authenticates a user and returns access and refresh tokens. Requires email and password.',
  })
  @ApiCreatedResponse({
    description: 'Login successful',
    type: SuccessResponseDto<LoginResponseDto>,
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or password',
  })
  @ApiBody({
    type: LoginDto,
    description: 'Login credentials',
  })
  async login(@Body() dto: LoginDto) {
    this.logger.debug(
      `POST /auth/login - Attempting login for email: ${dto.email}`,
    );

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
    type: SuccessResponseDto<LoginResponseDto>,
  })
  @ApiBadRequestResponse({
    description: 'Invalid refresh token',
  })
  async refresh(@GetUser() user: JwtPayload) {
    this.logger.debug(
      `POST /auth/refresh - Refreshing token for user: ${user.email}`,
    );

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
    type: SuccessResponseDto<null>,
  })
  async logout(@GetUser() user: JwtPayload) {
    this.logger.debug(`POST /auth/logout - Logging out user: ${user.email}`);

    await this.authService.logout(user);

    return this.success(null, 'Logout successful');
  }
}
