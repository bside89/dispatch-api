import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentOutboxTypes1775596616059 implements MigrationInterface {
  name = 'AddPaymentOutboxTypes1775596616059';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."outbox_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_CREATE_CUSTOMER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."outbox_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_UPDATE_CUSTOMER'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."outbox_type_enum" ADD VALUE IF NOT EXISTS 'PAYMENT_DELETE_CUSTOMER'`,
    );
  }

  async down(): Promise<void> {
    // Enum values are intentionally left in place to avoid destructive schema rewrites.
  }
}
