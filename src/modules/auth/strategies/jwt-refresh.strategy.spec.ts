import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { JwtRefreshStrategy } from './jwt-refresh.strategy';

// Stub out PassportStrategy so we can test validate() in isolation.
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: any, _name: string) => {
    return class {
      constructor(..._args: any[]) {}
    };
  },
}));

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-refresh-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validate', () => {
    const validPayload = {
      sub: 'user-uuid',
      email: 'user@example.com',
      role: 'USER',
      jti: 'refresh-jti-456',
    };

    it('should return user object with the raw refresh token from the Authorization header', async () => {
      const rawToken = 'raw-refresh-token-value';
      const mockReq = {
        headers: { authorization: `Bearer ${rawToken}` },
      } as any;

      const result = await strategy.validate(mockReq, validPayload);

      expect(result).toEqual({
        id: validPayload.sub,
        email: validPayload.email,
        role: validPayload.role,
        refreshToken: rawToken,
      });
    });

    it('should return undefined refreshToken when Authorization header is missing', async () => {
      const mockReq = { headers: {} } as any;

      const result = await strategy.validate(mockReq, validPayload);

      expect(result.refreshToken).toBeUndefined();
    });

    it('should correctly strip the Bearer prefix from the token', async () => {
      const mockReq = {
        headers: { authorization: 'Bearer   token-with-leading-spaces' },
      } as any;

      const result = await strategy.validate(mockReq, validPayload);

      expect(result.refreshToken).toBe('token-with-leading-spaces');
    });

    it('should map sub to id in the returned user object', async () => {
      const mockReq = {
        headers: { authorization: 'Bearer some-token' },
      } as any;

      const result = await strategy.validate(mockReq, {
        ...validPayload,
        sub: 'another-user-id',
      });

      expect(result.id).toBe('another-user-id');
    });
  });
});
