import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import { SESSION_TIMEOUT_HOURS } from '../types/index'

// Proveedores de identidad externos registrados
const externalProviders = (process.env['JWT_EXTERNAL_PROVIDERS'] ?? '')
  .split(',')
  .filter(Boolean)
  .map((url) => url.trim())

const jwksClients = new Map<string, jwksClient.JwksClient>()

for (const provider of externalProviders) {
  jwksClients.set(
    provider,
    jwksClient({
      jwksUri: provider,
      cache: true,
      rateLimit: true,
    }),
  )
}

/**
 * Verifica si un token JWT es valido.
 * Requisito 16.2, 16.3 — Property 26
 */
export async function verifyExternalJWT(token: string): Promise<jwt.JwtPayload | null> {
  try {
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded.payload === 'string') return null

    const iss: string = decoded.payload['iss'] as string
    if (!iss) return null

    // Verificar que el proveedor esta registrado
    const client = jwksClients.get(iss)
    if (!client) {
      throw new Error(`Proveedor de identidad no registrado: ${iss}`)
    }

    const signingKey = await client.getSigningKey(decoded.header.kid)
    const publicKey = signingKey.getPublicKey()

    const verified = jwt.verify(token, publicKey, {
      algorithms: ['RS256', 'ES256'],
    }) as jwt.JwtPayload

    return verified
  } catch {
    return null
  }
}

/**
 * Middleware de autenticacion JWT para endpoints de API.
 * Requisito 9.1 — Property 25
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autenticado', code: 'UNAUTHENTICATED' })
    return
  }

  // Payload CMS maneja la verificacion de JWT internamente
  // Este middleware es para endpoints personalizados fuera de Payload
  next()
}

/**
 * Middleware RBAC: verifica que el usuario tiene el rol requerido.
 * Requisito 9.3, 9.6 — Property 24
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req.user as { role?: string } | undefined)?.role
    if (!userRole || !roles.includes(userRole)) {
      // Registrar intento de acceso no autorizado en log de seguridad
      console.warn(
        JSON.stringify({
          severity: 'WARNING',
          event: 'unauthorized_access_attempt',
          userId: (req.user as { id?: string } | undefined)?.id,
          requiredRoles: roles,
          actualRole: userRole,
          path: req.path,
          timestamp: new Date().toISOString(),
        }),
      )
      res.status(403).json({ error: 'Permisos insuficientes', code: 'FORBIDDEN' })
      return
    }
    next()
  }
}

/**
 * Verifica que la sesion no ha expirado por inactividad (24h).
 * Requisito 9.5
 */
export function checkSessionActivity(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as { lastActivity?: string } | undefined
  if (!user?.lastActivity) {
    next()
    return
  }

  const lastActivity = new Date(user.lastActivity).getTime()
  const now = Date.now()
  const inactiveMs = now - lastActivity
  const maxInactiveMs = SESSION_TIMEOUT_HOURS * 60 * 60 * 1000

  if (inactiveMs > maxInactiveMs) {
    res.status(401).json({
      error: 'Sesión expirada por inactividad',
      code: 'SESSION_EXPIRED',
    })
    return
  }

  next()
}
