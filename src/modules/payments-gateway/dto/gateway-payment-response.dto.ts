import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class GatewayPaymentResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Payment identifier',
    example: 'pi_123456789',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'Payment status',
    example: 'requires_confirmation',
  })
  status: string;

  @Expose({ name: 'client_secret' })
  @ApiPropertyOptional({
    description: 'Client secret used by the frontend to confirm payment',
    example: 'pi_123456789_secret_123456789',
  })
  clientSecret?: string | null;
}
