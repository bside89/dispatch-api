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
import { AuthMessageFactory } from './factories/auth-message.factory';

@Controller({ path: 'v1/auth', version: '1' })
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController extends BaseController {
  constructor(
    private readonly authService: AuthService,
    private readonly messages: AuthMessageFactory,
  ) {
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

    const message = await this.messages.responses.login(result.language);
    return this.success(result, message);
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

    const message = await this.messages.responses.refresh(result.language);
    return this.success(result, message);
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

    const message = await this.messages.responses.logout(user.jwtPayload.language);
    return this.success({}, message);
  }
}
