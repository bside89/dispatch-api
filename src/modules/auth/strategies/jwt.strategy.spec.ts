import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { JwtStrategy } from './jwt.strategy';
import { CacheService } from '../../cache/cache.service';
import { JwtStrategyName } from '../enums/jwt-strategy-name.enum';

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
          provide: CacheService,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    cacheService = module.get(CacheService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    const mockReq = {} as any;

    const validPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      role: 'USER',
      jti: 'token-jti-123',
    };

    it('should return the user object when the token is valid and not blacklisted', async () => {
      cacheService.get.mockResolvedValue(null); // not blacklisted

      const result = await strategy.validate(mockReq, validPayload);

      expect(cacheService.get).toHaveBeenCalledWith(
        `blacklist:${validPayload.jti}`,
      );
      expect(result).toEqual({
        id: validPayload.sub,
        email: validPayload.email,
        role: validPayload.role,
        jti: validPayload.jti,
      });
    });

    it('should throw UnauthorizedException when the token jti is blacklisted', async () => {
      cacheService.get.mockResolvedValue('true'); // token is blacklisted

      await expect(strategy.validate(mockReq, validPayload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(mockReq, validPayload)).rejects.toThrow(
        'Token has been revoked',
      );
    });

    it('should map sub to id in the returned user object', async () => {
      cacheService.get.mockResolvedValue(null);
      const payload = { ...validPayload, sub: 'specific-user-id' };

      const result = await strategy.validate(mockReq, payload);

      expect(result.sub).toBe('specific-user-id');
    });
  });
});
