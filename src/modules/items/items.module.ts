import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsPublicController } from './items-public.controller';
import { ItemsAdminController } from './items-admin.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { ItemRepository } from '@/modules/items/providers/repositories/item.repository';
import { ItemMessageFactory } from '@/modules/items/providers/factories/item-message.factory';
import { ITEMS_SERVICE, ITEM_REPOSITORY } from './constants/items.token';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [ItemsPublicController, ItemsAdminController],
  providers: [
    { provide: ITEMS_SERVICE, useClass: ItemsService },
    { provide: ITEM_REPOSITORY, useClass: ItemRepository },
    ItemMessageFactory,
  ],
  exports: [ITEMS_SERVICE, ITEM_REPOSITORY],
})
export class ItemsModule {}
