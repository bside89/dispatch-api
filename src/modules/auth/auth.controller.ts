import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh.guard';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller({ path: 'v1/auth', version: '1' })
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController {
  private readonly logger: Logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  login(@Body() dto: LoginDto) {
    this.logger.debug(
      `POST /auth/login - Attempting login for email: ${dto.email}`,
    );
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  refresh(@GetUser() user: JwtPayload) {
    this.logger.debug(
      `POST /auth/refresh - Refreshing token for user: ${user.email}`,
    );
    return this.authService.refresh(user);
  }

  @Post('logout')
  logout(@GetUser() user: JwtPayload) {
    this.logger.debug(`POST /auth/logout - Logging out user: ${user.email}`);
    return this.authService.logout(user);
  }
}
