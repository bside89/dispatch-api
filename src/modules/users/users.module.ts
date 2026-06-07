import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DbGuardModule } from '@/shared/modules/db-guard/db-guard.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminUsersController } from './admin-users.controller';
import {
  ADDRESS_REPOSITORY,
  USERS_SERVICE,
  USER_REPOSITORY,
} from './constants/users.token';
import { Address } from './entities/address.entity';
import { User } from './entities/user.entity';
import { UserJobHandlerFactory } from './providers/factories/user-job-handler.factory';
import { UserMessageFactory } from './providers/factories/user-message.factory';
import { UsersProcessor } from './providers/processors/users.processor';
import { AddressRepository } from './providers/repositories/address.repository';
import { UserRepository } from './providers/repositories/user.repository';
import { UpdateCustomerIdJobStrategy } from './providers/strategies/update-customer-id-job.strategy';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Address]),
    DbGuardModule,
    PaymentsModule,
  ],
  controllers: [PublicUsersController, AdminUsersController],
  providers: [
    { provide: USERS_SERVICE, useClass: UsersService },
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: ADDRESS_REPOSITORY, useClass: AddressRepository },
    UserMessageFactory,
    UpdateCustomerIdJobStrategy,
    UserJobHandlerFactory,
    UsersProcessor,
  ],
  exports: [USERS_SERVICE, USER_REPOSITORY],
})
export class UsersModule {}
