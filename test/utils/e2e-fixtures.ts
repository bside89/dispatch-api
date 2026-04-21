/* eslint-disable @typescript-eslint/no-explicit-any */
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { ADMIN_USER } from '../constants/admin-user.constant';
import { UserRole } from '@/shared/enums/user-role.enum';
import { HashAdapter } from '@/shared/utils/hash-adapter.utils';
import type ms from 'ms';

const ADMIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$IDLXlbsUuUn15tmwMQPaUQ$xwXQGL/RHE9PlJ7xyXZD0yFSGFrPFEqNPUcr1JJue10';
const TEST_USER_PASSWORD = 'StrongPassword123!';

let testUserPasswordHashPromise: Promise<string> | undefined;

interface CreateFixtureUserOptions {
  email?: string;
  name?: string;
  role?: UserRole;
  customerId?: string;
}

interface CreateFixtureItemOptions {
  name?: string;
  description?: string;
  stock?: number;
  price?: number;
}

export function createAccessToken(
  jwtService: JwtService,
  user: { id: string; email: string; role: UserRole },
): string {
  return signToken(jwtService, user, 'access');
}

export function createRefreshToken(
  jwtService: JwtService,
  user: { id: string; email: string; role: UserRole },
): string {
  return signToken(jwtService, user, 'refresh');
}

export async function persistRefreshToken(
  dataSource: DataSource,
  userId: string,
  refreshToken: string,
) {
  const refreshTokenHash = await HashAdapter.hash(refreshToken);

  await dataSource.query(
    `UPDATE "users"
     SET "refreshToken" = $2
     WHERE id = $1`,
    [userId, refreshTokenHash],
  );
}

function signToken(
  jwtService: JwtService,
  user: { id: string; email: string; role: UserRole },
  type: 'access' | 'refresh',
): string {
  const secret =
    type === 'access'
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;
  const expiresIn =
    type === 'access'
      ? ((process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as ms.StringValue)
      : ((process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as ms.StringValue);

  return jwtService.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: crypto.randomUUID(),
    } as any,
    {
      secret,
      expiresIn,
    } as any,
  );
}

export async function createFixtureUser(
  dataSource: DataSource,
  options: CreateFixtureUserOptions = {},
) {
  const userId = crypto.randomUUID();
  const email = options.email ?? `user-${userId}@test.com`;
  const name = options.name ?? 'Regular Test User';
  const role = options.role ?? UserRole.USER;
  const customerId = options.customerId ?? `cus_${userId.replace(/-/g, '')}`;

  const passwordHash = await getTestUserPasswordHash();

  await dataSource.query(
    `INSERT INTO "users" (id, name, "customerId", email, password, role)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, name, customerId, email, passwordHash, role],
  );

  return {
    id: userId,
    email,
    name,
    role,
    customerId,
    password: TEST_USER_PASSWORD,
  };
}

export async function createFixtureItem(
  dataSource: DataSource,
  options: CreateFixtureItemOptions = {},
) {
  const [item] = await dataSource.query(
    `INSERT INTO "items" (name, description, stock, price, "pricePaymentId")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, stock, price, "pricePaymentId"`,
    [
      options.name ?? 'Test Product',
      options.description ?? 'A test product for order tests',
      options.stock ?? 1000,
      options.price ?? 14999,
      null,
    ],
  );

  return item;
}

export function getAdminFixture() {
  return {
    id: ADMIN_USER.id,
    email: ADMIN_USER.email,
    name: ADMIN_USER.name,
    role: UserRole.ADMIN,
    password: ADMIN_USER.password,
    passwordHash: ADMIN_PASSWORD_HASH,
  };
}

async function getTestUserPasswordHash(): Promise<string> {
  if (!testUserPasswordHashPromise) {
    testUserPasswordHashPromise = HashAdapter.hash(TEST_USER_PASSWORD);
  }

  return testUserPasswordHashPromise;
}
