import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { CacheService } from '../../shared/modules/cache/cache.service';
import { UserRepository } from '../users/repositories/user.repository';
import { OutboxService } from '../../shared/modules/outbox/outbox.service';
import Redlock from 'redlock';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: { sign: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: { set: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: UserRepository,
          useValue: { findOne: jest.fn(), update: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {},
        },
        {
          provide: OutboxService,
          useValue: { add: jest.fn() },
        },
        {
          provide: Redlock,
          useValue: { acquire: jest.fn(), release: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
