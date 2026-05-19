import type { Endpoint, PayloadRequest } from 'payload'
import type { Page, Tenant } from '../../payload-types.ts'
import {
  withV1Auth,
  jsonResponse,
  jsonError,
  requireTenantAccess,
} from './auth.ts'

function parseBody<T>(req: PayloadRequest): Promise<T> {
  if (!req.json) {
    return Promise.reject(new Error('JSON parser no disponible'))
  }
  return req.json() as Promise<T>
}

function v1Segments(pathname: string): string[] {
  const parts = pathname.split('/').filter(Boolean)
  const v1Index = parts.indexOf('v1')
  return v1Index >= 0 ? parts.slice(v1Index + 1) : []
}

async function handleTenants(req: PayloadRequest): Promise<Response> {
  return withV1Auth(req, async ({ req: payloadReq, claims }) => {
    const url = new URL(payloadReq.url ?? 'http://localhost', 'http://localhost')
    const segments = v1Segments(url.pathname)
    const tenantId = segments[1]

    if (payloadReq.method === 'GET' && segments.length === 1) {
      if (claims['role'] !== 'platform_admin') {
        const allowedTenant = String(claims['tenant_id'] ?? '')
        if (!allowedTenant) {
          return jsonError(403, 'FORBIDDEN', 'Permisos insuficientes para listar tenants')
        }
        const tenant = await payloadReq.payload.findByID({
          collection: 'tenants',
          id: allowedTenant,
          overrideAccess: true,
        })
        return jsonResponse({ docs: [tenant], totalDocs: 1 })
      }

      const result = await payloadReq.payload.find({
        collection: 'tenants',
        limit: 100,
        overrideAccess: true,
      })
      return jsonResponse(result)
    }

    if (payloadReq.method === 'POST' && segments.length === 1) {
      if (claims['role'] !== 'platform_admin') {
        return jsonError(403, 'FORBIDDEN', 'Solo platform_admin puede crear tenants')
      }
      const body = await parseBody<Partial<Tenant>>(payloadReq)
      const created = await payloadReq.payload.create({
        collection: 'tenants',
        data: body as Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>,
        overrideAccess: true,
      })
      return jsonResponse(created, 201)
    }

    if (payloadReq.method === 'GET' && segments.length === 2 && tenantId) {
      const denied = requireTenantAccess(claims, tenantId, url.pathname)
      if (denied) return denied
      const tenant = await payloadReq.payload.findByID({
        collection: 'tenants',
        id: tenantId,
        overrideAccess: true,
      })
      return jsonResponse(tenant)
    }

    if (payloadReq.method === 'PATCH' && segments.length === 2 && tenantId) {
      const denied = requireTenantAccess(claims, tenantId, url.pathname)
      if (denied) return denied
      const body = await parseBody<Partial<Tenant>>(payloadReq)
      const updated = await payloadReq.payload.update({
        collection: 'tenants',
        id: tenantId,
        data: body,
        overrideAccess: true,
      })
      return jsonResponse(updated)
    }

    return jsonError(404, 'NOT_FOUND', 'Ruta no encontrada')
  })
}

async function handleTenantNested(req: PayloadRequest): Promise<Response> {
  return withV1Auth(req, async ({ req: payloadReq, claims }) => {
    const url = new URL(payloadReq.url ?? 'http://localhost', 'http://localhost')
    const segments = v1Segments(url.pathname)
    const tenantId = segments[1]
    const resource = segments[2]
    const resourceId = segments[3]

    if (!tenantId || !resource) {
      return jsonError(400, 'BAD_REQUEST', 'tenantId y recurso son obligatorios')
    }

    const denied = requireTenantAccess(claims, tenantId, url.pathname)
    if (denied) return denied

    const collectionMap: Record<string, string> = {
      domains: 'domains',
      pages: 'pages',
      posts: 'posts',
    }
    const collection = collectionMap[resource]
    if (!collection) {
      return jsonError(404, 'NOT_FOUND', 'Recurso no soportado')
    }

    if (payloadReq.method === 'GET' && !resourceId) {
      const result = await payloadReq.payload.find({
        collection: collection as 'domains',
        where: { tenant: { equals: tenantId } },
        limit: 100,
        overrideAccess: true,
      })
      return jsonResponse(result)
    }

    if (payloadReq.method === 'GET' && resourceId) {
      const doc = await payloadReq.payload.findByID({
        collection: collection as 'pages',
        id: resourceId,
        overrideAccess: true,
      })
      const docTenant =
        typeof doc['tenant'] === 'object' && doc['tenant'] !== null
          ? String((doc['tenant'] as { id: unknown }).id)
          : String(doc['tenant'])
      if (docTenant !== tenantId) {
        return jsonError(404, 'NOT_FOUND', 'Documento no encontrado')
      }
      return jsonResponse(doc)
    }

    if (payloadReq.method === 'POST' && !resourceId) {
      const body = await parseBody<Record<string, unknown>>(payloadReq)
      const tenantRef = Number(tenantId)
      const created = await payloadReq.payload.create({
        collection: collection as 'pages',
        data: { ...body, tenant: tenantRef } as Omit<Page, 'id' | 'createdAt' | 'updatedAt'>,
        overrideAccess: true,
      })
      return jsonResponse(created, 201)
    }

    if (payloadReq.method === 'PATCH' && resourceId) {
      const body = await parseBody<Partial<Page>>(payloadReq)
      const updated = await payloadReq.payload.update({
        collection: collection as 'pages',
        id: resourceId,
        data: body,
        overrideAccess: true,
      })
      return jsonResponse(updated)
    }

    if (payloadReq.method === 'DELETE' && resourceId) {
      await payloadReq.payload.delete({
        collection: collection as 'pages',
        id: resourceId,
        overrideAccess: true,
      })
      return new Response(null, { status: 204, headers: { 'X-API-Version': '1' } })
    }

    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido')
  })
}

const v1Handler = async (req: PayloadRequest): Promise<Response> => {
  const url = new URL(req.url ?? 'http://localhost', 'http://localhost')
  const path = url.pathname.replace(/^\/api/, '')

  if (path === '/v1/tenants' || path.match(/^\/v1\/tenants\/[^/]+$/)) {
    return handleTenants(req)
  }

  if (path.match(/^\/v1\/tenants\/[^/]+\/(domains|pages|posts)(\/[^/]+)?$/)) {
    return handleTenantNested(req)
  }

  return jsonError(404, 'NOT_FOUND', 'Ruta API v1 no encontrada')
}

export const v1ApiEndpoints: Endpoint[] = [
  { path: '/v1/tenants', method: 'get', handler: v1Handler },
  { path: '/v1/tenants', method: 'post', handler: v1Handler },
  { path: '/v1/tenants/:id', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:id', method: 'patch', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/domains', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/domains', method: 'post', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/domains/:domainId', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/domains/:domainId', method: 'patch', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/domains/:domainId', method: 'delete', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/pages', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/pages', method: 'post', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/pages/:pageId', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/pages/:pageId', method: 'patch', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/pages/:pageId', method: 'delete', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/posts', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/posts', method: 'post', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/posts/:postId', method: 'get', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/posts/:postId', method: 'patch', handler: v1Handler },
  { path: '/v1/tenants/:tenantId/posts/:postId', method: 'delete', handler: v1Handler },
]
