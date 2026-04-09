import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateUserAddressDto } from './create-user.dto';
import { Type } from 'class-transformer';

export class UpdateUserAddressDto extends PartialType(CreateUserAddressDto) {}

export class UpdateUserDto {
  @ApiProperty({
    description: 'User full name',
    example: 'João Silva',
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: 'User email address',
    example: 'joao.silva@email.com',
    format: 'email',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'User address',
    type: UpdateUserAddressDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateUserAddressDto)
  address?: UpdateUserAddressDto;
}
