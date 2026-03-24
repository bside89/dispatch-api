import { ApiProperty } from '@nestjs/swagger';

export class LoginResponseDto {
  @ApiProperty({ description: 'Access token for authentication' })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token for obtaining new access tokens',
  })
  refreshToken: string;
}
