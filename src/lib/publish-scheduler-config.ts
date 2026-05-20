/**
 * Publicación programada (Cloud Scheduler → /api/internal/publish-scheduled).
 * Desactivado por defecto; activar con PUBLISH_SCHEDULER_ENABLED=true en Cloud Run + Terraform.
 */
export function isPublishSchedulerEnabled(): boolean {
  const raw = process.env['PUBLISH_SCHEDULER_ENABLED']?.trim().toLowerCase()
  return raw === 'true' || raw === '1'
}

export const PUBLISH_SCHEDULER_DISABLED_MESSAGE =
  'La publicación programada está desactivada. No uses el estado «Programado» hasta habilitar el job en infra (enable_publish_scheduler) y PUBLISH_SCHEDULER_ENABLED=true en el CMS.'
