/**
 * Campos añadidos a Express.Request por middleware propio (auth, RLS).
 * Debe estar en .d.ts e incluirse en tsconfig.typecheck.json.
 */
declare global {
  namespace Express {
    interface Request {
      tenantId?: string
      user?: unknown
    }
  }
}

export {}
