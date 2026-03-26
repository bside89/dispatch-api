import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller({ version: VERSION_NEUTRAL })
@ApiTags('default')
export class AppController {
  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
