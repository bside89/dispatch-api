import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceDeactivatedFieldsToEntities1776411764159 implements MigrationInterface {
  name = 'ReplaceDeactivatedFieldsToEntities1776411764159';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(`ALTER TABLE "items" DROP COLUMN "deactivated"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "deactivated"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deactivated"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_email" ON "users" ("email") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_email" ON "users" ("email", "deactivated") `,
    );
  }
}
