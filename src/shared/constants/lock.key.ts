export const LOCK_KEY = {
  AUTH: {
    LOGIN: (uniqueId: string) => `auth-login:${uniqueId}`,
    REFRESH: (uniqueId: string) => `auth-refresh:${uniqueId}`,
    LOGOUT: (uniqueId: string) => `auth-logout:${uniqueId}`,
  },

  USER: {
    CREATE: (uniqueId: string) => `user-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `user-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `user-remove:${uniqueId}`,
  },

  ORDER: {
    CREATE: (uniqueId: string) => `order-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `order-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `order-remove:${uniqueId}`,
  },

  ITEM: {
    CREATE: (uniqueId: string) => `item-create:${uniqueId}`,
    UPDATE: (uniqueId: string) => `item-update:${uniqueId}`,
    REMOVE: (uniqueId: string) => `item-remove:${uniqueId}`,
  },

  JOB: {
    EXECUTE: (uniqueId: string) => `job-execute:${uniqueId}`,
  },
};
