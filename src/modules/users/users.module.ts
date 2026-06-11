import { DbGuardModule } from '@/shared/modules/db-guard/db-guard.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from '../payments/payments.module';
import { UsersAdminController } from './users-admin.controller';
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
import { UpdateUserJobStrategy } from './providers/strategies/update-user-job.strategy';
import { UsersPublicController } from './users-public.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Address]),
    DbGuardModule,
    PaymentsModule,
  ],
  controllers: [UsersPublicController, UsersAdminController],
  providers: [
    { provide: USERS_SERVICE, useClass: UsersService },
    { provide: USER_REPOSITORY, useClass: UserRepository },
    { provide: ADDRESS_REPOSITORY, useClass: AddressRepository },
    UserMessageFactory,
    UpdateUserJobStrategy,
    UserJobHandlerFactory,
    UsersProcessor,
  ],
  exports: [USERS_SERVICE, USER_REPOSITORY],
})
export class UsersModule {}
