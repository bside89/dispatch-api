/* eslint-disable @typescript-eslint/no-explicit-any */
export class CreateNotificationDto {
  userId: string;

  type: string;

  title: string;

  message: string;

  data?: Record<string, any>;
}
