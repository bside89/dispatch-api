import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { ItemRepository } from './repositories/item.repository';
import { ItemMessageFactory } from './factories/item-message.factory';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [ItemsController],
  providers: [ItemsService, ItemRepository, ItemMessageFactory],
  exports: [ItemsService, ItemRepository],
})
export class ItemsModule {}
