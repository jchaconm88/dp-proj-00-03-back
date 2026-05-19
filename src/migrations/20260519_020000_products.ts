import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_products_category" AS ENUM('mujer', 'hombre', 'hogar', 'liquidacion');
    CREATE TYPE "public"."enum_products_status" AS ENUM('draft', 'published');

    CREATE TABLE "products" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "title" varchar NOT NULL,
      "slug" varchar,
      "category" "enum_products_category" NOT NULL,
      "status" "enum_products_status" DEFAULT 'published' NOT NULL,
      "price" varchar NOT NULL,
      "old_price" varchar,
      "badge" varchar,
      "emoji" varchar,
      "cta_label" varchar DEFAULT 'Seleccionar opciones',
      "href" varchar,
      "image_id" integer,
      "sort_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk"
      FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "products_tenant_idx" ON "products" USING btree ("tenant_id");
    CREATE INDEX "products_category_idx" ON "products" USING btree ("category");
    CREATE INDEX "products_status_idx" ON "products" USING btree ("status");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "products" CASCADE;
    DROP TYPE "public"."enum_products_category";
    DROP TYPE "public"."enum_products_status";
  `)
}
