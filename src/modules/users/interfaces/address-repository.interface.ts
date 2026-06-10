import { IBaseRepository } from '@/shared/providers/repositories/base-repository.interface';
import { Address } from '../entities/address.entity';

export interface IAddressRepository extends IBaseRepository<Address> {}
