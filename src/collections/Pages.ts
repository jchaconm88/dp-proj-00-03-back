import type { CollectionConfig, CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import { rejectScheduledIfDisabled } from '../hooks/reject-scheduled-if-disabled.ts'
import {
  getContentPreviousStatus,
  resolveContentChangeEvent,
  storeContentPreviousStatus,
} from '../hooks/content-previous-status.ts'
import { refId } from '../lib/payload-ids.ts'
import { notifyContentChange } from '../services/webhook.ts'
import {
  deletePublishedVersion,
  upsertPublishedVersion,
} from '../services/published-content-versions.ts'
import {
  loadActiveTemplateManifest,
  validatePageTranslationsTemplateData,
} from '../services/template-data-validation.ts'

const afterChangeWebhook: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  const event = resolveContentChangeEvent(operation, doc, getContentPreviousStatus(req))

  const tenantId = refId(doc['tenant'])
  const slug = String(doc['slug'] ?? '').trim()

  if (doc['status'] === 'published' && slug) {
    await upsertPublishedVersion(req, { tenantId, collection: 'pages', slug })
  } else if (event === 'content.unpublished' && slug) {
    await deletePublishedVersion(req, { tenantId, collection: 'pages', slug })
  }

  await notifyContentChange({
    event,
    tenantId,
    collection: 'pages',
    documentId: refId(doc['id']),
    timestamp: new Date().toISOString(),
  })
}

const validateTemplateDataHook: CollectionBeforeChangeHook = async ({ data, req }) => {
  const templateId = data['templateId'] as string | undefined
  const tenantRef = data['tenant']
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
      ? String((tenantRef as { id: unknown }).id)
      : tenantRef
        ? String(tenantRef)
        : undefined

  if (!templateId?.trim() || !tenantId) return data

  const manifest = await loadActiveTemplateManifest(req.payload, tenantId, templateId.trim())
  if (!manifest) {
    throw new Error(
      JSON.stringify([
        {
          field: 'templateId',
          message: `No hay plantilla activa con templateId "${templateId}" para este tenant`,
        },
      ]),
    )
  }

  validatePageTranslationsTemplateData(manifest, data['translations'])
  return data
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'slug',
    group: 'Contenido',
  },
  access: {
    create: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    read: () => true,
    update: ({ req }) => {
      const role = req.user?.role ?? ''
      if (role === 'viewer') return false
      return ['platform_admin', 'tenant_admin', 'editor'].includes(role)
    },
    delete: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
  },
  hooks: {
    beforeChange: [
      rejectScheduledIfDisabled,
      validateTemplateDataHook,
      storeContentPreviousStatus,
      async ({ data }) => {
        // Validar fecha de programacion futura — Property 11
        if (data['status'] === 'scheduled' && data['scheduledDate']) {
          const scheduled = new Date(data['scheduledDate'] as string)
          if (scheduled <= new Date()) {
            throw new Error(
              JSON.stringify([
                {
                  field: 'scheduledDate',
                  message: 'La fecha de programación debe ser futura',
                },
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
    {
      name: 'slug',
      type: 'text',
      required: true,
      admin: { description: 'URL slug de la página (ej: sobre-nosotros)' },
    },
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
    {
      name: 'pageType',
      type: 'select',
      required: true,
      defaultValue: 'static',
      options: [
        { label: 'Página estática', value: 'static' },
        { label: 'Landing page', value: 'landing' },
      ],
    },
    {
      name: 'publishDate',
      type: 'date',
      admin: { description: 'Fecha en que fue publicado' },
    },
    {
      name: 'scheduledDate',
      type: 'date',
      admin: { description: 'Fecha programada para publicación automática' },
    },
    {
      name: 'hasSchemaOrg',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Incluir datos estructurados Schema.org en esta página' },
    },
    {
      name: 'seoConfig',
      type: 'group',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          maxLength: 70,
          admin: { description: 'Título SEO (máx 70 caracteres)' },
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          maxLength: 160,
          admin: { description: 'Meta description (máx 160 caracteres)' },
        },
        {
          name: 'canonicalUrl',
          type: 'text',
          admin: { description: 'URL canónica' },
        },
        {
          name: 'ogImage',
          type: 'text',
          admin: { description: 'URL de imagen para Open Graph' },
        },
      ],
    },
    {
      name: 'translations',
      type: 'array',
      fields: [
        { name: 'languageCode', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'content', type: 'richText' },
        { name: 'metaTitle', type: 'text', maxLength: 70 },
        { name: 'metaDescription', type: 'textarea', maxLength: 160 },
        { name: 'canonicalUrl', type: 'text' },
        {
          name: 'templateData',
          type: 'json',
          admin: {
            description: 'Secciones editables según la plantilla (templateId de la página).',
            components: {
              Field: '@/components/admin/TemplateDataField#TemplateDataField',
            },
          },
        },
      ],
    },
    {
      name: 'templateId',
      type: 'text',
      admin: { description: 'ID de la plantilla HTML asignada a esta página' },
    },
  ],
}
