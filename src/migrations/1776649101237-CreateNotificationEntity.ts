import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotificationEntity1776649101237 implements MigrationInterface {
  name = 'CreateNotificationEntity1776649101237';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deactivatedAt" TIMESTAMP, "userId" uuid NOT NULL, "type" character varying(50) NOT NULL, "title" character varying(120) NOT NULL, "message" text NOT NULL, "data" jsonb, "read" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_createdAt_id_active" ON "notifications" ("userId", "createdAt", "id") WHERE "deactivatedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("userId") WHERE "read" = false AND "deactivatedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD "deactivatedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "deactivatedAt"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_read"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_user_createdAt_id_active"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
