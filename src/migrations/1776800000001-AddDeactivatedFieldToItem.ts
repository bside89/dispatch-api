import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeactivatedFieldToItem1776800000001 implements MigrationInterface {
  name = 'AddDeactivatedFieldToItem1776800000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD "deactivatedAt" TIMESTAMP DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "deactivatedAt"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "deactivated"`);
  }
}
