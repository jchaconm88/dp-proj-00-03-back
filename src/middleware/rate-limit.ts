import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

/**
 * Rate limiting para APIs externas: 100 req/min por cliente autenticado.
 * Requisito 16.7 — Property 27
 */
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Clave por token de autenticacion (si existe) o IP como fallback
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      // Usar los primeros 32 chars del token como clave (suficiente para unicidad)
      return `token:${token.slice(0, 32)}`
    }
    return `ip:${req.ip ?? 'unknown'}`
  },
  message: {
    error: 'Límite de peticiones excedido',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  },
  skip: (req: Request): boolean => {
    // No aplicar rate limit a endpoints internos
    return req.path.startsWith('/api/internal/')
  },
})

/**
 * Rate limiting mas estricto para formularios de contacto (anti-spam).
 */
export const contactFormRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // max 5 envios por minuto por IP
  keyGenerator: (req: Request): string => `contact:${req.ip ?? 'unknown'}`,
  message: {
    error: 'Demasiados envíos. Por favor espera un momento.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
})
