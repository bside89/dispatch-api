import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly jwtService: JwtService,
    private readonly cacheService: CacheService,
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

  async refresh(userPayload: User): Promise<LoginResponseDto> {
    const refreshToken = userPayload.refreshToken;
    if (!refreshToken)
      throw new UnauthorizedException('No refresh token found');

    const user = await this.userRepository.findOne({
      where: { email: userPayload.email },
      select: ['id', 'email', 'password', 'role', 'refreshToken'],
    });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await this.verifyPasswordOrToken(
      user.refreshToken,
      refreshToken,
    );
    if (!isValid) {
      await this.logout(user.id);
      throw new UnauthorizedException(
        'Invalid refresh token. User logged out. Please log in again.',
      );
    }
    const tokens = await this.generateTokens(userPayload);

    // Update the stored refresh token to the new one (optional, can keep the same refresh token until it expires)
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(user: any): Promise<void> {
    // Invalidate the JWT by storing its jti in the cache with a short expiration
    await this.cacheService.set(`blacklist:${user.jti}`, true, 15 * 60 * 1000); // 15 minutes
    await this.userRepository.update(user.id, {
      refreshToken: null,
    });
  }

  private async generateTokens(user: any): Promise<LoginResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(), // Generate a random JWT ID for token revocation
    };

    // Generate access token with short expiration and refresh token with longer expiration
    const accessTokenExpiry =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshTokenExpiry =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    // Sign the tokens with different secrets for added security
    const accessToken = this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTokenExpiry as any,
    });
    const refreshToken = this.jwtService.sign(payload as any, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTokenExpiry as any,
    });

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
