import { IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryDto } from '@/shared/dto/base-query.dto';

export class UserQueryDto extends BaseQueryDto {
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
