import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload'

/** Guarda el status previo en req.context (no en data: no es columna de BD). */
export const storeContentPreviousStatus: CollectionBeforeChangeHook = async ({
  originalDoc,
  req,
  data,
}) => {
  if (originalDoc && originalDoc['status'] != null) {
    req.context = {
      ...req.context,
      contentPreviousStatus: originalDoc['status'],
    }
  }
  return data
}

export function getContentPreviousStatus(req: PayloadRequest): string | undefined {
  const v = req.context?.['contentPreviousStatus']
  return typeof v === 'string' ? v : undefined
}

export function resolveContentChangeEvent(
  operation: string,
  doc: Record<string, unknown>,
  previousStatus: string | undefined,
): 'content.created' | 'content.updated' | 'content.published' | 'content.unpublished' {
  if (operation === 'create') return 'content.created'
  if (doc['status'] === 'published') return 'content.published'
  if (previousStatus === 'published' && doc['status'] !== 'published') return 'content.unpublished'
  return 'content.updated'
}
