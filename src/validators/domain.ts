/**
 * Valida un hostname según RFC 1123.
 * - Labels alfanuméricos con guiones (no empezando/terminando en guión)
 * - Longitud de label: 1-63 caracteres
 * - Longitud total: máximo 253 caracteres
 * - Requisito 2.1, 2.6, Property 6
 */
export function validateRFC1123Hostname(hostname: string): boolean {
  if (!hostname || hostname.length === 0) return false
  if (hostname.length > 253) return false

  // Eliminar punto final si existe (FQDN)
  const normalized = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname

  const labels = normalized.split('.')

  if (labels.length === 0) return false

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false
    if (label.startsWith('-') || label.endsWith('-')) return false
    if (!/^[a-zA-Z0-9-]+$/.test(label)) return false
  }

  return true
}

/**
 * Verifica que un hostname no sea una IP ni un hostname reservado.
 */
export function isPublicDomain(hostname: string): boolean {
  // Rechazar IPs
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return false
  // Rechazar localhost y similares
  if (['localhost', '127.0.0.1', '::1', 'local'].includes(hostname)) return false
  return true
}
