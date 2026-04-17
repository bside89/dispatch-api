import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserRepository } from './repositories/user.repository';
import { PaymentsGatewayModule } from '../payments-gateway/payments-gateway.module';
import { UserMessageFactory } from './factories/user-message.factory';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), PaymentsGatewayModule],
  controllers: [PublicUsersController, AdminUsersController],
  providers: [UsersService, UserRepository, UserMessageFactory],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
