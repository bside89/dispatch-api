export interface GatewayPaymentParams {
  amount: number;
  currency: string;
  customerId?: string;
  receiptEmail?: string;
  metadata?: Record<string, string>;
}
