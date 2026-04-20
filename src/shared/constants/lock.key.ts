export const LOCK_KEY = {
  AUTH: {
    LOGIN: (uniqueId: string) => `auth-login:${uniqueId}`,
    REFRESH: (uniqueId: string) => `auth-refresh:${uniqueId}`,
    LOGOUT: (uniqueId: string) => `auth-logout:${uniqueId}`,
  } as const,

  USER: {
    CREATE: (uniqueId: string) => `user-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `user-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `user-remove:${uniqueId}`,
  } as const,

  ORDER: {
    CREATE: (uniqueId: string) => `order-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `order-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `order-remove:${uniqueId}`,
  } as const,

  ITEM: {
    CREATE: (uniqueId: string) => `item-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `item-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `item-remove:${uniqueId}`,
  } as const,

  NOTIFICATIONS: {
    CREATE: (uniqueId: string) => `notifications-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `notifications-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `notifications-remove:${uniqueId}`,
  } as const,

  JOB: {
    EXECUTE: (uniqueId: string) => `job-execute:${uniqueId}`,
  } as const,
} as const;
