import { Exclude, Expose } from 'class-transformer';
import { BaseAddressDto } from './base-address.dto';

export class UserAddressSnapshotDto extends BaseAddressDto {}

@Exclude()
export class UserSnapshotDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  email: string;

  @Expose()
  customerId?: string;

  @Expose()
  address?: UserAddressSnapshotDto;
}
