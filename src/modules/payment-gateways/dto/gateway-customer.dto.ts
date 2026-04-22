import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';

export class GatewayAddressDto extends BaseAddressDto {}

export class GatewayCreateCustomerDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GatewayAddressDto)
  address?: GatewayAddressDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;
}

export class GatewayUpdateCustomerDto extends PartialType(
  GatewayCreateCustomerDto,
) {}
