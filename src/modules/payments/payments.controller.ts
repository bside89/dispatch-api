import { Controller } from '@nestjs/common';
import { BaseController } from '../../shared/controllers/base.controller';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController extends BaseController {
  constructor(private readonly paymentsService: PaymentsService) {
    super(PaymentsController.name);
  }
}
