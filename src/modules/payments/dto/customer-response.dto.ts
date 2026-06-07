import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class CustomerResponseDto {
  @Expose()
  id: string;

  @Expose()
  gatewayCustomerId: string;

  @Expose()
  userId: string;

  @Expose()
  email: string;

  @Expose()
  name: string;
}
