import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "html_templates"
      ADD COLUMN IF NOT EXISTS "manifest" jsonb;

    ALTER TABLE "pages_translations"
      ADD COLUMN IF NOT EXISTS "template_data" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "html_templates" DROP COLUMN IF EXISTS "manifest";
    ALTER TABLE "pages_translations" DROP COLUMN IF EXISTS "template_data";
  `)
}
