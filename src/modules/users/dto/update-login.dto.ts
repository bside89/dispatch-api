import {
  IsString,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'joao.silva@email.com',
    format: 'email',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User current password',
    example: 'currentPassword123',
    minLength: 6,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  currentPassword?: string;

  @ApiProperty({
    description: 'User new password',
    example: 'newSecurePassword123',
    minLength: 6,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  newPassword?: string;
}
