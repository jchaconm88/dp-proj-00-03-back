import type { Endpoint } from 'payload'

export const publicProductsEndpoint: Endpoint = {
  path: '/public/products/:tenantId',
  method: 'get',
  handler: async (req) => {
    const tenantId = req.routeParams?.['tenantId'] as string
    if (!tenantId) {
      return Response.json({ error: 'tenantId is required' }, { status: 400 })
    }

    const url = new URL(req.url ?? 'http://localhost', 'http://localhost')
    const category = url.searchParams.get('category') ?? undefined
    const slugsParam = url.searchParams.get('slugs') ?? undefined
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 100)
    const slugList = slugsParam
      ? slugsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    const where: Record<string, unknown> = {
      and: [
        { tenant: { equals: tenantId } },
        { status: { equals: 'published' } },
      ],
    }

    if (category) {
      (where['and'] as unknown[]).push({ category: { equals: category } })
    }

    if (slugList.length > 0) {
      (where['and'] as unknown[]).push({ slug: { in: slugList } })
    }

    const result = await req.payload.find({
      collection: 'products',
      where: where as never,
      sort: 'sortOrder',
      limit,
      depth: 1,
      overrideAccess: true,
    })

    let products = result.docs.map((doc) => {
      const imageRef = doc['image']
      let imageUrl: string | null = null
      if (typeof imageRef === 'object' && imageRef !== null && 'url' in imageRef) {
        const raw = (imageRef as { url?: string }).url
        if (raw) {
          imageUrl = raw.startsWith('http')
            ? raw
            : `${process.env['PAYLOAD_PUBLIC_SERVER_URL'] ?? ''}${raw}`
        }
      }

      return {
        id: doc['id'],
        title: doc['title'],
        slug: doc['slug'],
        category: doc['category'],
        price: doc['price'],
        oldPrice: doc['oldPrice'] ?? null,
        badge: doc['badge'] ?? null,
        emoji: doc['emoji'] ?? '👟',
        ctaLabel: doc['ctaLabel'] ?? 'Ver producto',
        href: doc['href'] ?? '#',
        imageUrl,
        sortOrder: doc['sortOrder'] ?? 0,
      }
    })

    if (slugList.length > 0) {
      const bySlug = new Map(products.map((p) => [p.slug ?? '', p]))
      products = slugList
        .map((slug) => bySlug.get(slug))
        .filter((p): p is (typeof products)[number] => p != null)
    }

    return Response.json({ products, tenantId, category: category ?? null })
  },
}
