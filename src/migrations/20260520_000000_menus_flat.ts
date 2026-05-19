import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drizzle falla si hay varios arrays anidados llamados "children".
 * Menú plano (un nivel) + columnas icon/active en items.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "menus_items_children_children" CASCADE;
    DROP TABLE IF EXISTS "menus_items_children" CASCADE;

    ALTER TABLE "menus_items" ADD COLUMN IF NOT EXISTS "icon" varchar;
    ALTER TABLE "menus_items" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT false;

    ALTER TABLE "menus_items" DROP COLUMN IF EXISTS "depth";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "menus_items" DROP COLUMN IF EXISTS "icon";
    ALTER TABLE "menus_items" DROP COLUMN IF EXISTS "active";
    ALTER TABLE "menus_items" ADD COLUMN IF NOT EXISTS "depth" numeric DEFAULT 1;

    CREATE TABLE IF NOT EXISTS "menus_items_children" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "url" varchar NOT NULL,
      "sort_order" numeric DEFAULT 0,
      "depth" numeric DEFAULT 2
    );

    CREATE TABLE IF NOT EXISTS "menus_items_children_children" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "url" varchar NOT NULL,
      "sort_order" numeric DEFAULT 0,
      "depth" numeric DEFAULT 3
    );
  `)
}
