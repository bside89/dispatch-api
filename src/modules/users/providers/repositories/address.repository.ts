import { BaseRepository } from '@/shared/repositories/base.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Address } from '../../entities/address.entity';
import { IAddressRepository } from '../../interfaces/address-repository.interface';

export class AddressRepository
  extends BaseRepository<Address>
  implements IAddressRepository
{
  constructor(@InjectRepository(Address) repository: Repository<Address>) {
    super(repository);
  }
}
