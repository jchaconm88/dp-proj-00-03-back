import type { PayloadRequest } from 'payload'
import type { JwtPayload } from 'jsonwebtoken'
import { verifyExternalJWT } from '../../middleware/auth.ts'
import { checkV1RateLimit } from './rate-limit.ts'

export interface V1Context {
  req: PayloadRequest
  claims: JwtPayload
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'X-API-Version': '1' },
  })
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return Response.json({ error: message, code, ...extra }, { status, headers: { 'X-API-Version': '1' } })
}

export function logSecurityEvent(event: string, details: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      severity: 'WARNING',
      event,
      component: 'api-v1',
      timestamp: new Date().toISOString(),
      ...details,
    }),
  )
}

export function hasTenantAccess(claims: JwtPayload, tenantId: string): boolean {
  if (claims['role'] === 'platform_admin') return true
  if (String(claims['tenant_id'] ?? '') === tenantId) return true
  const tenants = claims['tenants']
  if (Array.isArray(tenants)) {
    return tenants.map(String).includes(tenantId)
  }
  return false
}

export async function withV1Auth(
  req: PayloadRequest,
  handler: (ctx: V1Context) => Promise<Response>,
): Promise<Response> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHENTICATED', 'No autenticado')
  }

  const token = authHeader.slice(7)
  const rateKey = `token:${token.slice(0, 32)}`
  if (!checkV1RateLimit(rateKey)) {
    return jsonError(429, 'RATE_LIMIT_EXCEEDED', 'Límite de peticiones excedido', { retryAfter: 60 })
  }

  const claims = await verifyExternalJWT(token)
  if (!claims) {
    return jsonError(401, 'UNAUTHENTICATED', 'Token JWT inválido, expirado o proveedor no registrado')
  }

  return handler({ req, claims })
}

export function requireTenantAccess(
  claims: JwtPayload,
  tenantId: string,
  path: string,
): Response | null {
  if (hasTenantAccess(claims, tenantId)) return null

  logSecurityEvent('unauthorized_tenant_access', {
    tenantId,
    path,
    sub: claims['sub'],
  })

  return jsonError(403, 'FORBIDDEN', 'Permisos insuficientes sobre el tenant solicitado')
}
