import { PartialType } from '@nestjs/swagger';
import {
  CreatePgwCustomerAddressDto,
  CreatePgwCustomerDto,
  CreatePgwCustomerMetadataDto,
} from './create-pgw-customer.dto';

export class UpdatePgwCustomerMetadataDto extends PartialType(
  CreatePgwCustomerMetadataDto,
) {}

export class UpdatePgwCustomerAddressDto extends PartialType(
  CreatePgwCustomerAddressDto,
) {}

export class UpdatePgwCustomerDto extends PartialType(CreatePgwCustomerDto) {}
