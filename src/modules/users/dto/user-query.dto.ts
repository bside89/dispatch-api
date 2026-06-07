import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UserQueryDto {
  @ApiPropertyOptional({
    description: 'Filter users by name (partial match)',
    example: 'João',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter users by email (partial match)',
    example: 'joao@email.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class PublicUserQueryDto extends PickType(UserQueryDto, ['name'] as const) {}
