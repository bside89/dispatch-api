export type CacheServiceMock = {
  get: jest.Mock;
  set: jest.Mock;
  deleteBulk: jest.Mock;
};

export type OutboxServiceMock = {
  add: jest.Mock;
};

export type DataSourceMock = {
  transaction: jest.Mock;
};

export type RedlockMock = {
  acquire: jest.Mock;
  release: jest.Mock;
};

export const createCacheServiceMock = (): CacheServiceMock => ({
  get: jest.fn(),
  set: jest.fn(),
  deleteBulk: jest.fn(),
});

export const createOutboxServiceMock = (): OutboxServiceMock => ({
  add: jest.fn(),
});

export const createDataSourceMock = (): DataSourceMock => ({
  transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
    callback({}),
  ),
});

export const createRedlockMock = (): RedlockMock => ({
  acquire: jest.fn(),
  release: jest.fn(),
});
