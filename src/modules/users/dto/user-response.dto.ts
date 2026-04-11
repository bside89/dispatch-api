import { BaseAddressDto } from '@/shared/dto/base-address.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';

export class UserAddressResponseDto extends BaseAddressDto {}

@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'User full name',
    example: 'João Silva',
  })
  name: string;

  @Expose()
  @ApiProperty({
    description: 'User email address',
    example: 'joao.silva@email.com',
  })
  email: string;

  @Expose()
  @ApiProperty({
    description: 'User role',
    example: UserRole.USER,
  })
  role: UserRole;

  @Expose()
  @ApiProperty({
    description: 'User creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: 'User last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;

  @Expose()
  @ApiProperty({
    description: 'User address',
    type: UserAddressResponseDto,
    nullable: true,
  })
  address?: UserAddressResponseDto;
}
