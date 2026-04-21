export const I18N_ITEMS = {
  RESPONSES: {
    CREATE: 'items.responses.create',
    FIND_ONE: 'items.responses.findOne',
    UPDATE: 'items.responses.update',
    DELETE: 'items.responses.delete',
  } as const,
  ERRORS: {
    NOT_FOUND: 'items.errors.notFound',
    INSUFFICIENT_STOCK: 'items.errors.insufficientStock',
  } as const,
} as const;
