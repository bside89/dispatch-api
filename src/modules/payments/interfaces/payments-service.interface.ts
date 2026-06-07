import { PagCursorResultDto } from '@/shared/dto/pag-cursor-result.dto';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { CustomerResponseDto } from '../dto/customer-response.dto';
import { PaymentCursorQueryDto } from '../dto/payment-cursor-query.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { RefundResponseDto } from '../dto/refund-response.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';

export interface IPaymentsService {
  createPayment(dto: CreatePaymentDto): Promise<PaymentResponseDto>;

  findAllPayments(
    query: PaymentCursorQueryDto,
  ): Promise<PagCursorResultDto<PaymentResponseDto>>;

  findOnePayment(paymentId: string): Promise<PaymentResponseDto>;

  findPaymentByOrderId(orderId: string): Promise<PaymentResponseDto>;

  createCustomer(
    dto: CreateCustomerDto,
    idempotencyKey: string,
  ): Promise<CustomerResponseDto>;

  findOneCustomer(customerId: string): Promise<CustomerResponseDto>;

  findCustomerByUserId(userId: string): Promise<CustomerResponseDto>;

  updateCustomer(dto: UpdateCustomerDto): Promise<CustomerResponseDto>;

  deleteCustomer(userId: string): Promise<void>;

  createRefund(
    dto: CreateRefundDto,
    idempotencyKey: string,
  ): Promise<RefundResponseDto>;
}
