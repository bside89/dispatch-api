import { LoginResponseDto } from '../dto/login-response.dto';
import type { RequestUser } from './request-user.interface';

export interface IAuthService {
  login(email: string, password: string): Promise<LoginResponseDto>;

  refresh(reqUser: RequestUser): Promise<LoginResponseDto>;

  logout(reqUser: RequestUser): Promise<void>;
}
