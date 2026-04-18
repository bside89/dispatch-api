import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PublicItemsController } from './public-items.controller';
import { AdminItemsController } from './admin-items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { ItemRepository } from './repositories/item.repository';
import { ItemMessageFactory } from './factories/item-message.factory';
import { ITEMS_SERVICE, ITEM_REPOSITORY } from './constants/items.tokens';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [PublicItemsController, AdminItemsController],
  providers: [
    { provide: ITEMS_SERVICE, useClass: ItemsService },
    { provide: ITEM_REPOSITORY, useClass: ItemRepository },
    ItemMessageFactory,
  ],
  exports: [ITEMS_SERVICE, ITEM_REPOSITORY],
})
export class ItemsModule {}
