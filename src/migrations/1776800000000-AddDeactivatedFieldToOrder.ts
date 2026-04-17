import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeactivatedFieldToOrder1776800000000 implements MigrationInterface {
  name = 'AddDeactivatedFieldToOrder1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "deactivatedAt" TIMESTAMP DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deactivatedAt"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deactivated"`);
  }
}
