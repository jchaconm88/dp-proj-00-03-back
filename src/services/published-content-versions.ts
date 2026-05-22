import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

export type PublishedContentCollection = 'pages' | 'posts'

function parseTenantId(tenantId: string): number | null {
  const n = Number.parseInt(tenantId, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function upsertPublishedVersion(
  req: PayloadRequest,
  args: { tenantId: string; collection: PublishedContentCollection; slug: string },
): Promise<void> {
  const tenantId = parseTenantId(args.tenantId)
  const slug = args.slug?.trim()
  if (tenantId == null || !slug) return

  const contentVersion = Date.now()

  await req.payload.db.execute({
    sql: sql`
      INSERT INTO "published_content_versions" ("tenant_id", "collection", "slug", "content_version")
      VALUES (${tenantId}, ${args.collection}, ${slug}, ${contentVersion})
      ON CONFLICT ("tenant_id", "collection", "slug")
      DO UPDATE SET
        "content_version" = EXCLUDED."content_version",
        "updated_at" = now();
    `,
  })
}

export async function deletePublishedVersion(
  req: PayloadRequest,
  args: { tenantId: string; collection: PublishedContentCollection; slug: string },
): Promise<void> {
  const tenantId = parseTenantId(args.tenantId)
  const slug = args.slug?.trim()
  if (tenantId == null || !slug) return

  await req.payload.db.execute({
    sql: sql`
      DELETE FROM "published_content_versions"
      WHERE "tenant_id" = ${tenantId}
        AND "collection" = ${args.collection}
        AND "slug" = ${slug};
    `,
  })
}
