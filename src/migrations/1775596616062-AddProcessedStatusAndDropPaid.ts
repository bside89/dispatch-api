import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessedStatusAndDropPaid1775596616062 implements MigrationInterface {
  name = 'AddProcessedStatusAndDropPaid1775596616062';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."orders_status_enum" ADD VALUE IF NOT EXISTS 'PROCESSED'`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paid"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paid" boolean NOT NULL DEFAULT false`,
    );
    // Note: removing enum values is not supported in PostgreSQL without full type recreation.
  }
}
