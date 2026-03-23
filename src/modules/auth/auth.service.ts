import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPasswordOrToken(passwordOrToken: string): Promise<string> {
    return argon2.hash(passwordOrToken, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verifyPasswordOrToken(
    hash: string,
    passwordOrToken: string,
  ): Promise<boolean> {
    return argon2.verify(hash, passwordOrToken);
  }

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'password', 'role'],
    });

    if (!user) throw new UnauthorizedException();

    const isValid = await this.verifyPasswordOrToken(user.password, password);
    if (!isValid) throw new UnauthorizedException();

    const tokens = await this.generateTokens(user);

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async refresh(user: User): Promise<LoginResponseDto> {
    const tokens = await this.generateTokens(user, false); // Don't generate a new refresh token on refresh

    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
    });
  }

  private async generateTokens(
    user: any,
    includeRefreshToken = true,
  ): Promise<LoginResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Generate access token with short expiration and refresh token with longer expiration
    const accessTokenExpiry =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const refreshTokenExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const accessToken = this.jwtService.sign(payload as any, {
      expiresIn: accessTokenExpiry as any,
    });
    let refreshToken: string | undefined;
    if (includeRefreshToken) {
      refreshToken = this.jwtService.sign(payload as any, {
        expiresIn: refreshTokenExpiry as any,
      });
    }

    const result: LoginResponseDto = {
      accessToken,
      refreshToken,
    };

    return result;
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    // Store hashed refresh token in the database for security
    const hash = await this.hashPasswordOrToken(refreshToken);
    await this.userRepository.update(userId, { refreshToken: hash });
  }
}
