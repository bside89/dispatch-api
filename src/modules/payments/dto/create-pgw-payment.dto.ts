export class CreatePgwPaymentMetadataDto {
  orderId: string;
}

export class CreatePgwPaymentDto {
  amount: number;

  currency: string;

  customerId?: string;

  receiptEmail?: string;

  metadata?: CreatePgwPaymentMetadataDto;

  idempotencyKey: string;
}
