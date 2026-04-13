import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShippingFieldsToOrders1775596616063 implements MigrationInterface {
  name = 'AddShippingFieldsToOrders1775596616063';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "trackingNumber" character varying DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "carrier" character varying DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP DEFAULT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "deliveredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "shippedAt"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "carrier"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "trackingNumber"`,
    );
  }
}
