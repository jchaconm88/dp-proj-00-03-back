import type { Endpoint, PayloadRequest } from 'payload'
import { parseMenusSeed, upsertMenusForTenant } from '../services/template-menus-import.ts'

const EDITOR_ROLES = ['platform_admin', 'tenant_admin', 'editor'] as const

export const adminImportMenusEndpoint: Endpoint = {
  path: '/admin/import-menus',
  method: 'post',
  handler: async (req: PayloadRequest) => {
    if (!req.user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!EDITOR_ROLES.includes(req.user.role as (typeof EDITOR_ROLES)[number])) {
      return Response.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let body: unknown
    try {
      if (!req.json) {
        return Response.json({ error: 'JSON no soportado' }, { status: 400 })
      }
      body = await req.json()
    } catch {
      return Response.json({ error: 'JSON inválido' }, { status: 400 })
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return Response.json({ error: 'Cuerpo inválido' }, { status: 400 })
    }

    const tenantId = (body as { tenantId?: unknown }).tenantId
    const menusRaw = (body as { menus?: unknown }).menus

    if (typeof tenantId !== 'string' || !tenantId.trim()) {
      return Response.json({ error: 'tenantId es obligatorio' }, { status: 400 })
    }

    let menus
    try {
      menus = parseMenusSeed(menusRaw)
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      )
    }

    if (menus.length === 0) {
      return Response.json({ error: 'menus está vacío' }, { status: 400 })
    }

    const result = await upsertMenusForTenant(req.payload, tenantId.trim(), menus)
    return Response.json(result)
  },
}
