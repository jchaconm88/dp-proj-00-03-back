import type { Endpoint } from 'payload'

/**
 * Resuelve un tenant por hostname de dominio activo.
 * Usado por el front SSR sin autenticación (Tenants no es legible públicamente vía REST).
 */
export const publicResolveTenantEndpoint: Endpoint = {
  path: '/public/resolve-tenant',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? 'http://localhost', 'http://localhost')
    const hostname = (url.searchParams.get('hostname') ?? '').toLowerCase().trim().split(':')[0]

    if (!hostname) {
      return Response.json({ error: 'hostname query parameter is required' }, { status: 400 })
    }

    const domains = await req.payload.find({
      collection: 'domains',
      where: {
        and: [
          { hostname: { equals: hostname } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    const domain = domains.docs[0]
    if (!domain) {
      return Response.json({ error: 'domain not found' }, { status: 404 })
    }

    const tenantRef = domain['tenant']
    const tenantId =
      typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
        ? tenantRef.id
        : tenantRef

    const tenant = await req.payload.findByID({
      collection: 'tenants',
      id: tenantId as string | number,
      overrideAccess: true,
    })

    const settings = (tenant['settings'] ?? {}) as Record<string, unknown>

    return Response.json({
      id: String(tenant['id']),
      name: tenant['name'],
      defaultLanguage: tenant['defaultLanguage'],
      timezone: tenant['timezone'],
      isActive: tenant['isActive'],
      settings: {
        contactEmail: settings['contactEmail'] ?? '',
        maxStorageBytes: settings['maxStorageBytes'] ?? 0,
        currentStorageBytes: settings['currentStorageBytes'] ?? 0,
        captchaEnabled: settings['captchaEnabled'] ?? false,
        frontendWebhookUrl: settings['frontendWebhookUrl'],
      },
      createdAt: tenant['createdAt'],
      updatedAt: tenant['updatedAt'],
    })
  },
}
