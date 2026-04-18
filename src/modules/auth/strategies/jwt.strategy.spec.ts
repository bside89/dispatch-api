/*eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import { CacheService } from '../../../shared/modules/cache/cache.service';
import { CACHE_SERVICE } from '../../../shared/modules/cache/constants/cache.tokens';
import { AUTH_KEY } from '../../../shared/modules/cache/constants/auth.key';
import { UserRole } from '@/shared/enums/user-role.enum';
import { createCacheServiceMock } from '@/shared/testing/provider-mocks';

// Stub out the PassportStrategy base so we can instantiate JwtStrategy
// without a real Passport JWT flow in unit tests.
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: any, _name: string) => {
    return class {
      constructor(..._args: any[]) {}
    };
  },
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    cacheService = createCacheServiceMock() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
        {
          provide: CACHE_SERVICE,
          useValue: cacheService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    const mockReq = {} as any;

    const validPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      role: UserRole.USER,
      jti: 'token-jti-123',
      language: 'en',
    };

    it('should return the user object when the token is valid and not blacklisted', async () => {
      cacheService.get.mockResolvedValue(null); // not blacklisted

      const result = await strategy.validate(mockReq, validPayload);

      expect(cacheService.get).toHaveBeenCalledWith(
        AUTH_KEY.BLACKLIST(validPayload.jti),
      );
      expect(result).toEqual({
        id: validPayload.sub,
        jwtPayload: {
          sub: validPayload.sub,
          email: validPayload.email,
          role: validPayload.role,
          jti: validPayload.jti,
          language: validPayload.language,
        },
      });
    });

    it('should throw UnauthorizedException when the token jti is blacklisted', async () => {
      cacheService.get.mockResolvedValue('true'); // token is blacklisted

      await expect(strategy.validate(mockReq, validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should map sub to id in the returned user object', async () => {
      cacheService.get.mockResolvedValue(null);
      const payload = { ...validPayload, sub: 'specific-user-id' };

      const result = await strategy.validate(mockReq, payload);

      expect(result.id).toBe('specific-user-id');
    });
  });
});
