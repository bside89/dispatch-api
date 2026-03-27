import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1774650855457 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
            CREATE TYPE "order_status_enum" AS ENUM (
                'PENDING', 'CONFIRMED', 'PROCESSED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "user_role_enum" AS ENUM ('user', 'admin')
        `);

    // Create users table
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id"           UUID              NOT NULL DEFAULT uuid_generate_v4(),
                "name"         VARCHAR           NOT NULL,
                "email"        VARCHAR           NOT NULL,
                "password"     VARCHAR           NOT NULL,
                "role"         "user_role_enum"  NOT NULL DEFAULT 'user',
                "refreshToken" VARCHAR,
                "createdAt"    TIMESTAMP         NOT NULL DEFAULT now(),
                "updatedAt"    TIMESTAMP         NOT NULL DEFAULT now(),
                CONSTRAINT "PK_users" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_users_email" UNIQUE ("email")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_user_email" ON "users" ("email")
        `);

    // Create orders table
    await queryRunner.query(`
            CREATE TABLE "orders" (
                "id"        UUID                 NOT NULL DEFAULT uuid_generate_v4(),
                "userId"    UUID,
                "status"    "order_status_enum"  NOT NULL DEFAULT 'PENDING',
                "total"     DECIMAL(10,2)        NOT NULL,
                "createdAt" TIMESTAMP            NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP            NOT NULL DEFAULT now(),
                CONSTRAINT "PK_orders" PRIMARY KEY ("id"),
                CONSTRAINT "FK_orders_user" FOREIGN KEY ("userId")
                    REFERENCES "users" ("id") ON DELETE SET NULL
            )
        `);

    // Create order_items table
    await queryRunner.query(`
            CREATE TABLE "order_items" (
                "id"        UUID          NOT NULL DEFAULT uuid_generate_v4(),
                "orderId"   UUID          NOT NULL,
                "productId" VARCHAR       NOT NULL,
                "quantity"  INTEGER       NOT NULL,
                "price"     DECIMAL(10,2) NOT NULL,
                "createdAt" TIMESTAMP     NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP     NOT NULL DEFAULT now(),
                CONSTRAINT "PK_order_items" PRIMARY KEY ("id"),
                CONSTRAINT "FK_order_items_order" FOREIGN KEY ("orderId")
                    REFERENCES "orders" ("id") ON DELETE CASCADE
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP INDEX "IDX_user_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "order_status_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_enum"`);
  }
}
