import { BaseRepository } from '@/shared/providers/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../../entities/customer.entity';
import { ICustomerRepository } from '../../interfaces/customer-repository.interface';

@Injectable()
export class CustomerRepository
  extends BaseRepository<Customer>
  implements ICustomerRepository
{
  constructor(@InjectRepository(Customer) repository: Repository<Customer>) {
    super(repository);
  }
}
