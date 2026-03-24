export interface JwtPayload {
  sub: string;

  email: string;

  role: string;

  jti: string; // JWT ID, to identify the token and facilitate revocation
}
