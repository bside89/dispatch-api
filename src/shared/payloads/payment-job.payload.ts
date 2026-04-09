import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { BaseAddressDto } from '@/shared/dto/base-address.dto';

export class PaymentJobPayload extends BaseJobPayload {
  constructor(public readonly userId: string) {
    super();
  }
}

export class CreateCustomerJobPayload extends PaymentJobPayload {
  constructor(
    public readonly userId: string,
    public readonly userName: string,
    public readonly email: string,
    public readonly address?: BaseAddressDto,
  ) {
    super(userId);
  }
}

export class UpdateCustomerJobPayload extends PaymentJobPayload {
  constructor(
    public readonly userId: string,
    public readonly customerId: string,
    public readonly userName: string,
    public readonly email: string,
    public readonly address?: BaseAddressDto,
  ) {
    super(userId);
  }
}

export class DeleteCustomerJobPayload extends PaymentJobPayload {
  constructor(
    public readonly userId: string,
    public readonly customerId: string,
    public readonly userName: string,
    public readonly email: string,
  ) {
    super(userId);
  }
}
