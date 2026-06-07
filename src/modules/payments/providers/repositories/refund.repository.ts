import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Refund } from '../../entities/refund.entity';
import { IRefundRepository } from '../../interfaces/refund-repository.interface';

@Injectable()
export class RefundRepository
  extends BaseRepository<Refund>
  implements IRefundRepository
{
  constructor(@InjectRepository(Refund) repository: Repository<Refund>) {
    super(repository);
  }
}
