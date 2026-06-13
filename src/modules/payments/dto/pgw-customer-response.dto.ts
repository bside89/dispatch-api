import { OmitType } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import {
  CreatePgwCustomerAddressDto,
  CreatePgwCustomerDto,
  CreatePgwCustomerMetadataDto,
} from './create-pgw-customer.dto';

@Exclude()
export class PgwCustomerMetadataResponseDto extends CreatePgwCustomerMetadataDto {}

@Exclude()
export class PgwCustomerAddressResponseDto extends CreatePgwCustomerAddressDto {}

@Exclude()
export class PgwCustomerResponseDto extends OmitType(CreatePgwCustomerDto, [
  'metadata',
  'address',
  'idempotencyKey',
]) {
  @Expose()
  id: string;

  @Expose()
  metadata?: PgwCustomerMetadataResponseDto;

  @Expose()
  address?: PgwCustomerAddressResponseDto;
}
