import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLanguageFieldToUser1776191590132 implements MigrationInterface {
  name = 'AddLanguageFieldToUser1776191590132';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "language" character varying NOT NULL DEFAULT 'en'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
  }
}
