import { Controller, Get } from '@nestjs/common';

@Controller('admin')
export class AdminController {
  @Get('test')
  test() {
    return {
      message: 'Admin area protected - you should see authentication prompt',
      timestamp: new Date().toISOString(),
    };
  }
}
