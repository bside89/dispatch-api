import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PgwRefundResponseDto {
  @Expose()
  refundId: string;

  @Expose()
  paymentId: string;

  @Expose()
  amount: number;
}
