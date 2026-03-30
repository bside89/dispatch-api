import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

export class NotifyUserJobData extends BaseJobPayload {
  constructor(
    public readonly userId: string,
    public readonly userName: string,
    public readonly message: string,
  ) {
    super();
  }
}
