export abstract class BaseJobPayload {
  public readonly jobId: string = crypto.randomUUID();

  public readonly timestamp: string = new Date().toISOString();
}
