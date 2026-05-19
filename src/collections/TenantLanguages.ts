import type { CollectionConfig } from 'payload'
import { MAX_LANGUAGES_PER_TENANT } from '../types/index.ts'

export const TenantLanguages: CollectionConfig = {
  slug: 'tenant-languages',
  admin: {
    useAsTitle: 'languageCode',
    group: 'Tenants',
  },
  access: {
    create: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
    read: () => true,
    update: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
    delete: ({ req }) => ['platform_admin', 'tenant_admin'].includes(req.user?.role ?? ''),
  },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const tenantId = data['tenant'] as string | undefined

        if (tenantId && operation === 'create') {
          // Verificar limites de idiomas — Property 19
          const existing = await req.payload.find({
            collection: 'tenant-languages',
            where: { tenant: { equals: tenantId } },
          })

          if (existing.totalDocs >= MAX_LANGUAGES_PER_TENANT) {
            throw new Error(
              JSON.stringify([
                {
                  field: 'languageCode',
                  message: `El tenant ya tiene el máximo de ${MAX_LANGUAGES_PER_TENANT} idiomas configurados`,
                },
              ]),
            )
          }
        }

        // Si se marca como primario, desmarcar el anterior primario
        if (data['isPrimary'] === true && tenantId) {
          const primaryLanguages = await req.payload.find({
            collection: 'tenant-languages',
            where: {
              and: [
                { tenant: { equals: tenantId } },
                { isPrimary: { equals: true } },
              ],
            },
          })

          for (const lang of primaryLanguages.docs) {
            if (lang['id'] !== data['id']) {
              await req.payload.update({
                collection: 'tenant-languages',
                id: lang['id'] as string,
                data: { isPrimary: false },
              })
            }
          }
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'languageCode',
      type: 'text',
      required: true,
      admin: { description: 'Código de idioma ISO 639-1 (ej: es, en, fr, pt)' },
    },
    {
      name: 'isPrimary',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Si es el idioma principal del tenant (solo puede haber uno)',
      },
    },
  ],
}
