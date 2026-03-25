import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtStrategyName } from './enums/jwt-strategy-name.enum';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController {
  private readonly logger: Logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  refresh(@Req() req) {
    return this.authService.refresh(req.user);
  }

  @Post('logout')
  logout(@Req() req) {
    return this.authService.logout(req.user);
  }

  @Post('test')
  @Public()
  test() {
    this.logger.verbose({ foo: 'bar' }, 'baz %s', 'qux');
    this.logger.debug('foo %s %o', 'bar', { baz: 'qux' });
    this.logger.log('foo');
    this.logger.warn('foo %s', 'bar');
    this.logger.error('foo %s', 'bar');
    return { message: 'This is a test route' };
  }
}
