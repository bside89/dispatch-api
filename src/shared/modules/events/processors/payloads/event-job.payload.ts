import { BaseJobPayload } from '@/shared/jobs/base-job.payload';

export class EventJobPayload extends BaseJobPayload {}

export class NotifyUserJobPayload extends EventJobPayload {
  constructor(
    public readonly userId: string,
    public readonly userName: string,
    public readonly message: string,
  ) {
    super();
  }
}
