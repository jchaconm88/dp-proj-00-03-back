import { Resend } from 'resend'
import type { BasePayload } from 'payload'

let resendClient: Resend | undefined

function getResend(): Resend | undefined {
  const apiKey = process.env['RESEND_API_KEY']
  if (!apiKey) return undefined
  resendClient ??= new Resend(apiKey)
  return resendClient
}

const MAX_RETRIES = 3
const RETRY_INTERVAL_MS = 60 * 1000 // 1 minuto

interface ContactNotificationParams {
  submissionId: string
  tenantEmail: string
  name: string
  email: string
  message: string
  payload: BasePayload
}

/**
 * Envía notificación de formulario de contacto con reintentos.
 * Requisito 8.2, 8.7 — Property 23
 *
 * - Max 3 reintentos con intervalo de 1 minuto
 * - Si todos fallan: marca como 'failed' y registra en log
 */
export async function sendContactNotification(params: ContactNotificationParams): Promise<void> {
  const { submissionId, tenantEmail, name, email, message, payload } = params

  const resend = getResend()
  if (!resend) {
    payload.logger.warn({
      msg: 'RESEND_API_KEY no configurada; notificación no enviada',
      submissionId,
    })
    return
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await resend.emails.send({
        from: 'noreply@dp-proj-00-03.com',
        to: tenantEmail,
        subject: `Nuevo mensaje de contacto de ${name}`,
        html: buildContactEmailHtml({ name, email, message }),
        text: `Nombre: ${name}\nEmail: ${email}\nMensaje: ${message}`,
      })

      await payload.update({
        collection: 'contact-submissions',
        id: submissionId,
        data: { notificationStatus: 'sent' },
      })

      return
    } catch (error) {
      payload.logger.warn({
        msg: `Notificacion fallida (intento ${attempt}/${MAX_RETRIES})`,
        submissionId,
        error: error instanceof Error ? error.message : String(error),
      })

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_INTERVAL_MS)
      }
    }
  }

  // Todos los reintentos fallaron — Property 23
  await payload.update({
    collection: 'contact-submissions',
    id: submissionId,
    data: { notificationStatus: 'failed', retryCount: MAX_RETRIES },
  })

  payload.logger.error({
    msg: 'Notificacion fallida tras todos los reintentos',
    submissionId,
    retryCount: MAX_RETRIES,
    severity: 'ERROR',
    event: 'notification_failed',
  })
}

function buildContactEmailHtml(data: {
  name: string
  email: string
  message: string
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Nuevo mensaje de contacto</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #666;">Nombre:</td>
          <td style="padding: 8px;">${escapeHtml(data.name)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #666;">Email:</td>
          <td style="padding: 8px;">
            <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold; color: #666; vertical-align: top;">Mensaje:</td>
          <td style="padding: 8px; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
        </tr>
      </table>
    </div>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Envia una alerta al equipo de operaciones.
 * Requisito 13.2
 */
export async function sendSystemAlert(params: {
  severity: 'WARNING' | 'CRITICAL'
  component: string
  message: string
  details?: Record<string, unknown>
}): Promise<void> {
  const alertEmail = process.env['ALERT_EMAIL']
  if (!alertEmail) return

  const resend = getResend()
  if (!resend) return

  try {
    await resend.emails.send({
      from: 'alerts@dp-proj-00-03.com',
      to: alertEmail,
      subject: `[${params.severity}] ${params.component}: ${params.message}`,
      html: `
        <h3>${params.severity}: ${params.component}</h3>
        <p>${params.message}</p>
        ${params.details ? `<pre>${JSON.stringify(params.details, null, 2)}</pre>` : ''}
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    })
  } catch (error) {
    // No lanzar error en alertas — solo loggear
    console.error('Error enviando alerta del sistema:', error)
  }
}
