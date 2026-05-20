import React from 'react'
import {
  isPublishSchedulerEnabled,
  PUBLISH_SCHEDULER_DISABLED_MESSAGE,
} from '@/lib/publish-scheduler-config'

export const ScheduledPublishBanner: React.FC = () => {
  if (isPublishSchedulerEnabled()) {
    return null
  }

  return (
    <div
      role="alert"
      style={{
        margin: '0 0 1.25rem',
        padding: '1rem 1.25rem',
        borderRadius: '4px',
        border: '1px solid var(--theme-warning-500, #d97706)',
        background: 'var(--theme-warning-50, #fffbeb)',
        color: 'var(--theme-text, #1a1a1a)',
        fontSize: '0.9375rem',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
        Publicación programada desactivada
      </strong>
      <p style={{ margin: 0 }}>{PUBLISH_SCHEDULER_DISABLED_MESSAGE}</p>
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
        Para habilitarla: en <code>dp-proj-00-03-infra</code> pon{' '}
        <code>enable_publish_scheduler = true</code>, aplica Terraform, y en el deploy del CMS{' '}
        <code>PUBLISH_SCHEDULER_ENABLED=true</code>. Mientras tanto, publica con estado{' '}
        <strong>Publicado</strong>.
      </p>
    </div>
  )
}
