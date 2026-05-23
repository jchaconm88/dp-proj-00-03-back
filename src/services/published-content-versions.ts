import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'
import { refId } from '../lib/payload-ids.ts'

export type PublishedContentCollection = 'pages' | 'posts'

function parseTenantId(tenantId: string): number | null {
  const n = Number.parseInt(tenantId, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function getDrizzle(req: PayloadRequest): { execute: (query: ReturnType<typeof sql>) => Promise<unknown> } {
  const db = req.payload.db as { drizzle?: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> } }
  if (!db.drizzle) {
    throw new Error('Postgres drizzle adapter not available')
  }
  return db.drizzle
}

export async function resolveDocTenantId(
  req: PayloadRequest,
  collection: PublishedContentCollection,
  doc: Record<string, unknown>,
): Promise<string> {
  const fromDoc = refId(doc['tenant'])
  if (fromDoc) return fromDoc

  const docId = refId(doc['id'])
  if (!docId) return ''

  try {
    const row = await req.payload.findByID({
      collection,
      id: docId,
      depth: 0,
      overrideAccess: true,
      select: { tenant: true },
    })
    return refId(row?.['tenant'])
  } catch {
    return ''
  }
}

export async function upsertPublishedVersion(
  req: PayloadRequest,
  args: { tenantId: string; collection: PublishedContentCollection; slug: string },
): Promise<boolean> {
  const tenantId = parseTenantId(args.tenantId)
  const slug = args.slug?.trim()
  if (tenantId == null || !slug) {
    console.warn('[published-content-versions] skip upsert (tenant/slug)', {
      tenantId: args.tenantId,
      slug: args.slug,
      collection: args.collection,
    })
    return false
  }

  const contentVersion = Date.now()

  try {
    await getDrizzle(req).execute(sql`
      INSERT INTO "published_content_versions" ("tenant_id", "collection", "slug", "content_version")
      VALUES (${tenantId}, ${args.collection}, ${slug}, ${contentVersion})
      ON CONFLICT ("tenant_id", "collection", "slug")
      DO UPDATE SET
        "content_version" = EXCLUDED."content_version",
        "updated_at" = now();
    `)
    console.info('[published-content-versions] upsert ok', {
      tenantId,
      collection: args.collection,
      slug,
      contentVersion,
    })
    return true
  } catch (error) {
    console.error('[published-content-versions] upsert failed:', error)
    return false
  }
}

export async function deletePublishedVersion(
  req: PayloadRequest,
  args: { tenantId: string; collection: PublishedContentCollection; slug: string },
): Promise<boolean> {
  const tenantId = parseTenantId(args.tenantId)
  const slug = args.slug?.trim()
  if (tenantId == null || !slug) return false

  try {
    await getDrizzle(req).execute(sql`
      DELETE FROM "published_content_versions"
      WHERE "tenant_id" = ${tenantId}
        AND "collection" = ${args.collection}
        AND "slug" = ${slug};
    `)
    return true
  } catch (error) {
    console.error('[published-content-versions] delete failed:', error)
    return false
  }
}
