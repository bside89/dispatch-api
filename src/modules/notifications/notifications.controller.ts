import { Controller, Get, Inject, Param, Patch, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOkResponse,
  ApiParam,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { GetUser } from '@/shared/decorators/get-user.decorator';
import type { RequestUser } from '@/modules/auth/interfaces/request-user.interface';
import type { INotificationsService } from './interfaces/notifications-service.interface';
import { NOTIFICATIONS_SERVICE } from './constants/notifications.token';
import { BaseController } from '@/shared/controllers/base.controller';
import { CursorParamsPipe } from '@/shared/pipes/cursor-params.pipe';
import type { CursorParams } from '@/shared/types/cursor-params.type';
import { SkipThrottle } from '@nestjs/throttler';

@Controller({ path: 'v1/notifications', version: '1' })
@ApiTags('notifications')
@ApiSecurity('bearer')
export class NotificationsController extends BaseController {
  constructor(
    @Inject(NOTIFICATIONS_SERVICE)
    private readonly notificationsService: INotificationsService,
  ) {
    super(NotificationsController.name);
  }

  @Get()
  @SkipThrottle()
  @ApiOkResponse({ type: [NotificationResponseDto] })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  async findByUser(
    @GetUser() user: RequestUser,
    @Query('cursor', CursorParamsPipe) cursor: CursorParams,
  ) {
    const result = await this.notificationsService.findByUser(user.id, cursor);

    return this.paginateCursor(result);
  }

  @Patch(':id/read')
  @ApiParam({ name: 'id', description: 'Notification ID', type: String })
  async markAsRead(@GetUser() user: RequestUser, @Param('id') id: string) {
    await this.notificationsService.markAsRead(id, user.id);
    return { success: true };
  }

  @Get('unread/count')
  @SkipThrottle()
  @ApiOkResponse({ type: Number })
  async countUnread(@GetUser() user: RequestUser) {
    return this.notificationsService.countUnread(user.id);
  }

  @Get('has-new')
  @SkipThrottle()
  @ApiOkResponse({ type: Boolean })
  async hasNewNotifications(@GetUser() user: RequestUser) {
    return this.notificationsService.hasNewNotifications(user.id);
  }
}
