import { Injectable } from '@nestjs/common';
import { BaseService } from '../../shared/services/base.service';

@Injectable()
export class PaymentsService extends BaseService {
  constructor() {
    super(PaymentsService.name);
  }
}
