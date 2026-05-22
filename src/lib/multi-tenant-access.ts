import { getUserTenantIDs } from '@payloadcms/plugin-multi-tenant/utilities'
import type { AccessResult, PayloadRequest } from 'payload'

/**
 * El plugin multi-tenant usa el array `tenants` en el usuario.
 * Si solo está `tenantId` (legacy), el acceso a pages/posts falla con 403.
 */
export function legacyTenantAccessOverride({
  accessResult,
  req,
}: {
  accessResult: AccessResult
  req: PayloadRequest
}): AccessResult {
  if (accessResult !== false) return accessResult

  const user = req.user
  if (!user) return false

  if ((user as { role?: string }).role === 'platform_admin') {
    return true
  }

  const assigned = getUserTenantIDs(user as Parameters<typeof getUserTenantIDs>[0])
  if (assigned.length > 0) return accessResult

  const legacy = (user as { tenantId?: string | null }).tenantId?.trim()
  if (!legacy) return false

  const tenantNum = Number.parseInt(legacy, 10)
  if (!Number.isFinite(tenantNum) || tenantNum <= 0) return false

  return { tenant: { in: [tenantNum] } }
}
