import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentIntentFieldsToOrders1775596616061 implements MigrationInterface {
  name = 'AddPaymentIntentFieldsToOrders1775596616061';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentIntentId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentIntentStatus" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "paymentIntentStatus"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentIntentId"`);
  }
}
