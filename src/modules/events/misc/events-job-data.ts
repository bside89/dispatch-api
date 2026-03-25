export class NotifyUserJobData {
  public readonly notificationId: string = crypto.randomUUID();

  constructor(
    public readonly userId: string,
    public readonly message: string,
  ) {}
}
