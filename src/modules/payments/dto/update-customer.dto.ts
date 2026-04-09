import { PartialType } from '@nestjs/swagger';
import { CreateCustomerAddressDto, CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerAddressDto extends PartialType(
  CreateCustomerAddressDto,
) {}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
