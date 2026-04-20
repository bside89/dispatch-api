export const I18N_AUTH = {
  RESPONSES: {
    LOGIN: 'auth.responses.login',
    REFRESH: 'auth.responses.refresh',
    LOGOUT: 'auth.responses.logout',
  } as const,
  NOTIFICATIONS: {
    LOGIN: 'auth.notifications.login',
  } as const,
  ERRORS: {
    NO_REFRESH_TOKEN: 'auth.errors.noRefreshToken',
    INVALID_REFRESH_TOKEN: 'auth.errors.invalidRefreshToken',
    INVALID_PASSWORD: 'auth.errors.invalidPassword',
    TOKEN_REVOKED: 'auth.errors.tokenRevoked',
  } as const,
} as const;
