import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { notifyContentChange } from '../services/webhook.ts'

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

  await notifyContentChange({
    event,
    tenantId: doc['tenant'] as string,
    collection: 'pages',
    documentId: doc['id'] as string,
    timestamp: new Date().toISOString(),
  })
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
    update: ({ req }) =>
      ['platform_admin', 'tenant_admin', 'editor'].includes(req.user?.role ?? ''),
    delete: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc }) => {
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

        // Guardar estado anterior para el webhook
        if (originalDoc) {
          data['_previousStatus'] = originalDoc['status']
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
      ],
    },
    {
      name: 'templateId',
      type: 'text',
      admin: { description: 'ID de la plantilla HTML asignada a esta página' },
    },
  ],
}
