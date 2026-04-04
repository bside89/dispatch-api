import { JwtPayload } from './jwt-payload.interface';

export interface RequestUser {
  id: string;

  jwtPayload: JwtPayload;
}
