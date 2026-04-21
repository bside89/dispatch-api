import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangePaymentFieldsOfOrder1776807191835 implements MigrationInterface {
  name = 'ChangePaymentFieldsOfOrder1776807191835';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentIntentId"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN "paymentIntentStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentStatus" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentStatus"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentId"`);
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentIntentStatus" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentIntentId" character varying`,
    );
  }
}
