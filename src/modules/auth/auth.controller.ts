import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { AuthGuard } from '@nestjs/passport';
import { JwtStrategyName } from './enums/jwt-strategy-name.enum';

@Controller('auth')
@ApiTags('auth')
@ApiSecurity('bearer')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @UseGuards(AuthGuard(JwtStrategyName.Refresh))
  refresh(@Req() req) {
    return this.authService.refresh(req.user);
  }

  @Post('logout')
  logout(@Req() req) {
    return this.authService.logout(req.user.id);
  }
}
