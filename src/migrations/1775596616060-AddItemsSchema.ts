import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddItemsSchema1775596616060 implements MigrationInterface {
  name = 'AddItemsSchema1775596616060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create items table
    await queryRunner.query(
      `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying NOT NULL, "description" text NOT NULL, "stock" integer NOT NULL, "price" integer NOT NULL, "pricePaymentId" character varying, CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`,
    );

    // Add itemId column to order_items
    await queryRunner.query(`ALTER TABLE "order_items" ADD "itemId" uuid NOT NULL`);

    // Drop redundant columns from order_items
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "productId"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "price"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "updatedAt"`);

    // Add back createdAt and updatedAt managed by BaseEntity
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );

    // Add FK constraint from order_items.itemId to items.id
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove FK constraint
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_item"`,
    );

    // Drop createdAt and updatedAt (added in this migration)
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "createdAt"`);

    // Restore original columns in order_items
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "price" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "productId" character varying NOT NULL DEFAULT ''`,
    );

    // Remove itemId column
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "itemId"`);

    // Drop items table
    await queryRunner.query(`DROP TABLE "items"`);
  }
}
