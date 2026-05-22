import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { rejectScheduledIfDisabled } from '../hooks/reject-scheduled-if-disabled.ts'
import { refId } from '../lib/payload-ids.ts'
import { notifyContentChange } from '../services/webhook.ts'
import {
  deletePublishedVersion,
  upsertPublishedVersion,
} from '../services/published-content-versions.ts'

const afterChangeWebhook: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  let event: 'content.created' | 'content.updated' | 'content.published' | 'content.unpublished'

  if (operation === 'create') {
    event = 'content.created'
  } else if (doc['status'] === 'published') {
    event = 'content.published'
  } else if (doc['_previousStatus'] === 'published' && doc['status'] !== 'published') {
    event = 'content.unpublished'
  } else {
    event = 'content.updated'
  }

  const tenantId = refId(doc['tenant'])
  const slug = String(doc['slug'] ?? '').trim()

  if (doc['status'] === 'published' && slug) {
    await upsertPublishedVersion(req, { tenantId, collection: 'posts', slug })
  } else if (event === 'content.unpublished' && slug) {
    await deletePublishedVersion(req, { tenantId, collection: 'posts', slug })
  }

  await notifyContentChange({
    event,
    tenantId,
    collection: 'posts',
    documentId: refId(doc['id']),
    timestamp: new Date().toISOString(),
  })
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'slug',
    group: 'Contenido',
  },
  access: {
    create: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    read: () => true,
    update: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    delete: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
  },
  hooks: {
    beforeChange: [
      rejectScheduledIfDisabled,
      async ({ data }) => {
        if (data['status'] === 'scheduled' && data['scheduledDate']) {
          const scheduled = new Date(data['scheduledDate'] as string)
          if (scheduled <= new Date()) {
            throw new Error(
              JSON.stringify([
                { field: 'scheduledDate', message: 'La fecha de programación debe ser futura' },
              ]),
            )
          }
        }
        return data
      },
    ],
    afterChange: [afterChangeWebhook],
  },
  fields: [
    { name: 'slug', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Borrador', value: 'draft' },
        { label: 'Programado', value: 'scheduled' },
        { label: 'Publicado', value: 'published' },
      ],
    },
    { name: 'publishDate', type: 'date' },
    { name: 'scheduledDate', type: 'date' },
    {
      name: 'seoConfig',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text', maxLength: 70 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
        { name: 'canonicalUrl', type: 'text' },
        { name: 'ogImage', type: 'text' },
      ],
    },
    {
      name: 'translations',
      type: 'array',
      fields: [
        { name: 'languageCode', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'richText' },
        { name: 'excerpt', type: 'textarea' },
        { name: 'metaTitle', type: 'text', maxLength: 70 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
      ],
    },
  ],
}
