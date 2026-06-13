import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PgwPaymentResponseDto {
  @Expose()
  id: string;

  @Expose()
  status: string;

  @Expose()
  secret?: string;
}
