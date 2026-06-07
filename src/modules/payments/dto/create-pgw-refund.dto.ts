export class CreatePgwRefundDto {
  paymentId: string;

  amount: number;

  idempotencyKey: string;
}
