import crypto from 'crypto'
import type { ContentChangeWebhook } from '../types/index.ts'

/**
 * Notifica al frontend sobre cambios de contenido para rebuild incremental.
 * Requisito 15.2, 4.2, 4.4, 4.5 — el frontend regenera en <= 2 minutos
 */
export async function notifyContentChange(event: ContentChangeWebhook): Promise<void> {
  const webhookUrl = process.env['FRONTEND_WEBHOOK_URL']
  const webhookSecret = process.env['FRONTEND_WEBHOOK_SECRET']

  if (!webhookUrl) return

  const body = JSON.stringify(event)
  const signature = webhookSecret
    ? `sha256=${crypto.createHmac('sha256', webhookSecret).update(body).digest('hex')}`
    : undefined

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-Signature-256': signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    if (!response.ok) {
      console.warn(`Webhook al frontend fallo: ${response.status} ${response.statusText}`)
    }
  } catch (error) {
    // No lanzar error — el frontend tiene su propio mecanismo de fallback
    console.warn('Error enviando webhook al frontend:', error)
  }
}

/**
 * Notifica al frontend que un dominio cambio (activado, desactivado, eliminado).
 * Para invalidar cache de resolucion de dominios.
 */
export async function notifyFrontendDomainChange(hostname: string): Promise<void> {
  await notifyContentChange({
    event: 'content.updated',
    tenantId: 'system',
    collection: 'domains',
    documentId: hostname,
    timestamp: new Date().toISOString(),
  })
}
