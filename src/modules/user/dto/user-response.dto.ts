import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'João Silva',
  })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'joao.silva@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'User creation date',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'User last update date',
    example: '2024-01-01T12:00:00Z',
  })
  updatedAt: Date;
}
