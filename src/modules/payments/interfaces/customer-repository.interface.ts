import { IBaseRepository } from '@/shared/repositories/base-repository.interface';
import { Customer } from '../entities/customer.entity';

export interface ICustomerRepository extends IBaseRepository<Customer> {}
