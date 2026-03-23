import { Controller, Get } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';

@Controller('admin')
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
