import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_html_templates_status" AS ENUM('active', 'archived');

    CREATE TABLE "html_templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "template_id" varchar NOT NULL,
      "name" varchar NOT NULL,
      "status" "enum_html_templates_status" DEFAULT 'active' NOT NULL,
      "bundle_size_bytes" numeric,
      "storage_path" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );

    ALTER TABLE "html_templates" ADD CONSTRAINT "html_templates_tenant_id_tenants_id_fk"
      FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;

    CREATE INDEX "html_templates_tenant_idx" ON "html_templates" USING btree ("tenant_id");
    CREATE INDEX "html_templates_updated_at_idx" ON "html_templates" USING btree ("updated_at");
    CREATE INDEX "html_templates_created_at_idx" ON "html_templates" USING btree ("created_at");
    CREATE UNIQUE INDEX "html_templates_filename_idx" ON "html_templates" USING btree ("filename");
    CREATE INDEX "html_templates_template_id_idx" ON "html_templates" USING btree ("template_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "html_templates" CASCADE;
    DROP TYPE "public"."enum_html_templates_status";
  `)
}
