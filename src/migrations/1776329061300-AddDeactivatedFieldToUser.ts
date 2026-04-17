import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeactivatedFieldToUser1776329061300 implements MigrationInterface {
  name = 'AddDeactivatedFieldToUser1776329061300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deactivated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_email" ON "users" ("email", "deactivated") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_user_email"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deactivated"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_user_email" ON "users" ("email") `,
    );
  }
}
