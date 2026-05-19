import type { Endpoint } from 'payload'
import {
  parseProductsSeed,
  upsertProductsForTenant,
} from '../services/template-products-import.ts'

const EDITOR_ROLES = ['platform_admin', 'tenant_admin', 'editor'] as const

export const adminImportProductsEndpoint: Endpoint = {
  path: '/admin/import-products',
  method: 'post',
  handler: async (req) => {
    if (!req.user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!EDITOR_ROLES.includes(req.user.role as (typeof EDITOR_ROLES)[number])) {
      return Response.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const tenantId = (body as { tenantId?: unknown }).tenantId
    const productsRaw = (body as { products?: unknown }).products

    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return Response.json({ error: 'tenantId es obligatorio' }, { status: 400 })
    }

    let items
    try {
      items = parseProductsSeed(productsRaw)
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      )
    }

    if (items.length === 0) {
      return Response.json({ error: 'products está vacío' }, { status: 400 })
    }

    const result = await upsertProductsForTenant(req.payload, tenantId.trim(), items)
    return Response.json(result)
  },
}
