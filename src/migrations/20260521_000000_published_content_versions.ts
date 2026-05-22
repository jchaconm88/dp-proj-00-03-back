import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "published_content_versions" (
      "tenant_id" integer NOT NULL,
      "collection" varchar(16) NOT NULL,
      "slug" varchar(255) NOT NULL,
      "content_version" bigint NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("tenant_id", "collection", "slug"),
      CONSTRAINT "published_content_versions_collection_check"
        CHECK ("collection" IN ('pages', 'posts'))
    );
    CREATE INDEX IF NOT EXISTS "published_content_versions_tenant_idx"
      ON "published_content_versions" ("tenant_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "published_content_versions";
  `)
}
