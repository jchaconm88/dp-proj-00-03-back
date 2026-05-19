import type { Payload } from 'payload'
import { PRODUCT_CATEGORY_VALUES } from '../collections/Products.ts'

export type ProductSeedItem = {
  slug: string
  category: string
  title: string
  price: string
  oldPrice?: string
  badge?: string
  emoji?: string
  ctaLabel?: string
  href?: string
  status?: 'draft' | 'published'
  sortOrder?: number
}

export type ImportProductsResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ slug: string; message: string }>
}

function isProductSeedItem(value: unknown): value is ProductSeedItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const o = value as Record<string, unknown>
  return (
    typeof o['slug'] === 'string' &&
    o['slug'].trim().length > 0 &&
    typeof o['category'] === 'string' &&
    typeof o['title'] === 'string' &&
    typeof o['price'] === 'string'
  )
}

export function parseProductsSeed(raw: unknown): ProductSeedItem[] {
  if (!Array.isArray(raw)) {
    throw new Error('products debe ser un array')
  }
  const items: ProductSeedItem[] = []
  for (const entry of raw) {
    if (!isProductSeedItem(entry)) {
      throw new Error('Cada producto requiere slug, category, title y price')
    }
    if (!PRODUCT_CATEGORY_VALUES.includes(entry.category as (typeof PRODUCT_CATEGORY_VALUES)[number])) {
      throw new Error(`Categoría inválida: ${entry.category}`)
    }
    items.push(entry)
  }
  return items
}

export async function upsertProductsForTenant(
  payload: Payload,
  tenantId: string,
  items: ProductSeedItem[],
): Promise<ImportProductsResult> {
  const result: ImportProductsResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }

  for (const item of items) {
    const slug = item.slug.trim()
    try {
      const existing = await payload.find({
        collection: 'products',
        where: {
          and: [
            { tenant: { equals: tenantId } },
            { slug: { equals: slug } },
          ],
        },
        limit: 1,
        overrideAccess: true,
      })

      const data = {
        tenant: tenantId,
        slug,
        category: item.category,
        title: item.title,
        price: item.price,
        oldPrice: item.oldPrice,
        badge: item.badge,
        emoji: item.emoji ?? '👟',
        ctaLabel: item.ctaLabel ?? 'Seleccionar opciones',
        href: item.href ?? '#',
        status: item.status ?? 'published',
        sortOrder: item.sortOrder ?? 0,
      }

      if (existing.docs[0]) {
        await payload.update({
          collection: 'products',
          id: existing.docs[0]['id'] as string,
          data,
          overrideAccess: true,
        })
        result.updated += 1
      } else {
        await payload.create({
          collection: 'products',
          data,
          overrideAccess: true,
        })
        result.created += 1
      }
    } catch (err) {
      result.skipped += 1
      result.errors.push({
        slug,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
