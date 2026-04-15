import { BaseJobPayload } from '@/shared/payloads/base-job.payload';
import { UserSnapshotDto } from '../dto/user-snapshot.dto';

export class PaymentJobPayload extends BaseJobPayload {
  constructor(public readonly userDto: UserSnapshotDto) {
    super();
  }
}

export class CreateCustomerJobPayload extends PaymentJobPayload {}

export class UpdateCustomerJobPayload extends PaymentJobPayload {}

export class DeleteCustomerJobPayload extends PaymentJobPayload {}
