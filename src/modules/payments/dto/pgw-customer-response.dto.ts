import { OmitType } from '@nestjs/swagger';
import {
  CreatePgwCustomerAddressDto,
  CreatePgwCustomerDto,
  CreatePgwCustomerMetadataDto,
} from './create-pgw-customer.dto';

export class PgwCustomerMetadataResponseDto extends CreatePgwCustomerMetadataDto {}

export class PgwCustomerAddressResponseDto extends CreatePgwCustomerAddressDto {}

export class PgwCustomerResponseDto extends OmitType(CreatePgwCustomerDto, [
  'metadata',
  'address',
  'idempotencyKey',
]) {
  id: string;

  metadata?: PgwCustomerMetadataResponseDto;

  address?: PgwCustomerAddressResponseDto;
}
