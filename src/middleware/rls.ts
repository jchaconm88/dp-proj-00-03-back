import type { Request, Response, NextFunction } from 'express'

/**
 * Middleware que establece el tenant actual en la sesion de base de datos.
 * Se llama a set_current_tenant() antes de cada query para aplicar RLS.
 * Requisito 1.4, 9.2 — Property 1
 */
export function rlsMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const tenantId: string | undefined =
    (req.headers['x-tenant-id'] as string | undefined) ??
    (req.user as { tenantId?: string } | undefined)?.tenantId

  if (tenantId) {
    // El pool de conexiones de Payload maneja la sesion de BD.
    // set_current_tenant se llama via un hook de Payload antes de cada operacion.
    req.tenantId = tenantId
  }

  next()
}

declare module 'express-serve-static-core' {
  interface Request {
    tenantId?: string
    user?: unknown
  }
}
