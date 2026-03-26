import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller({ path: 'admin', version: VERSION_NEUTRAL })
@ApiTags('admin')
@ApiSecurity('bearer')
export class AdminController {
  @Get('test')
  test() {
    return {
      message: 'Admin area protected - you should see authentication prompt',
      timestamp: new Date().toISOString(),
    };
  }
}
