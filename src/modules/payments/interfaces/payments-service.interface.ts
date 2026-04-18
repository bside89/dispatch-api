export interface IPaymentsService {
  processWebhookEvent(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): Promise<void>;
}
