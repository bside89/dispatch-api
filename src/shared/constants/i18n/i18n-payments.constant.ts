export const I18N_PAYMENTS = {
  ERRORS: {
    STRIPE_SIGNATURE_REQUIRED: 'payments.errors.stripeSignatureRequired',
    WEBHOOK_SECRET_REQUIRED: 'payments.errors.webhookSecretRequired',
    CREATE_CUSTOMER_FAILED: 'payments.errors.createCustomerFailed',
    UPDATE_CUSTOMER_FAILED: 'payments.errors.updateCustomerFailed',
    CUSTOMER_DELETED: 'payments.errors.customerDeleted',
    CUSTOMER_NOT_FOUND: 'payments.errors.customerNotFound',
  } as const,
} as const;
