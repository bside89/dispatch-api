import { UserRole } from '@/modules/users/enums/user-role.enum';

export interface JwtPayload {
  sub: string;

  email: string;

  role: UserRole;

  language: string;

  jti: string; // JWT ID, to identify the token and facilitate revocation

  refreshToken?: string; // Optional field to store the refresh token for validation in the refresh strategy
}
