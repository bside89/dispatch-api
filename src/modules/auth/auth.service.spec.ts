import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { AuthMessageFactory } from './factories/auth-message.factory';
import { AUTH_SERVICE } from './constants/auth.token';
import { CACHE_SERVICE } from '../../shared/modules/cache/constants/cache.token';
import { USER_REPOSITORY } from '../users/constants/users.token';
import { OUTBOX_SERVICE } from '../../shared/modules/outbox/constants/outbox.token';
import Redlock from 'redlock';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AUTH_SERVICE, useClass: AuthService },
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
        {
          provide: CACHE_SERVICE,
          useValue: { set: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: USER_REPOSITORY,
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: OUTBOX_SERVICE,
          useValue: { add: jest.fn() },
        },
        {
          provide: AuthMessageFactory,
          useValue: {
            notifications: { login: jest.fn() },
            responses: { login: jest.fn(), refresh: jest.fn(), logout: jest.fn() },
            errors: {
              invalidRefreshToken: jest.fn(),
              invalidPassword: jest.fn(),
            },
          },
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AUTH_SERVICE);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
