import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { PaymentsGatewayModule } from '../payments-gateway/payments-gateway.module';
import { UserMessageFactory } from './factories/user-message.factory';
import { AdminUsersController } from './admin-users.controller';
import { USERS_SERVICE, USER_REPOSITORY } from './constants/users.tokens';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PaymentsGatewayModule],
  controllers: [PublicUsersController, AdminUsersController],
  providers: [
    { provide: USERS_SERVICE, useClass: UsersService },
    { provide: USER_REPOSITORY, useClass: UserRepository },
    UserMessageFactory,
  ],
  exports: [USERS_SERVICE, USER_REPOSITORY],
})
export class UsersModule {}
