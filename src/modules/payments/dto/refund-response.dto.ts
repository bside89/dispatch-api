import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class RefundResponseDto {
  @Expose()
  id: string;

  @Expose()
  paymentId: string;

  @Expose()
  amount: number;

  @Expose()
  gatewayRefundId: string;
}
