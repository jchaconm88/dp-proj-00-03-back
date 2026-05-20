import type { CollectionBeforeChangeHook } from 'payload'
import {
  isPublishSchedulerEnabled,
  PUBLISH_SCHEDULER_DISABLED_MESSAGE,
} from '../lib/publish-scheduler-config.ts'

/** Impide guardar Pages/Posts en estado scheduled cuando el job de infra está apagado. */
export const rejectScheduledIfDisabled: CollectionBeforeChangeHook = async ({ data }) => {
  if (data['status'] === 'scheduled' && !isPublishSchedulerEnabled()) {
    throw new Error(
      JSON.stringify([
        { field: 'status', message: PUBLISH_SCHEDULER_DISABLED_MESSAGE },
        { field: 'scheduledDate', message: PUBLISH_SCHEDULER_DISABLED_MESSAGE },
      ]),
    )
  }
  return data
}
