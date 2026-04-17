import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicItemsController } from './public-items.controller';
import { AdminItemsController } from './admin-items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { ItemRepository } from './repositories/item.repository';
import { ItemMessageFactory } from './factories/item-message.factory';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [PublicItemsController, AdminItemsController],
  providers: [ItemsService, ItemRepository, ItemMessageFactory],
  exports: [ItemsService, ItemRepository],
})
export class ItemsModule {}
