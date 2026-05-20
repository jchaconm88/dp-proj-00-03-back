import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import type { Tenant } from '../types/index.ts'

const MAX_STORAGE_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

const validateName: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  const name: string = (data['name'] as string | undefined)?.trim() ?? ''

  if (!name || name.length === 0) {
    throw new Error(JSON.stringify([{ field: 'name', message: 'El nombre es requerido' }]))
  }

  if (name.length > 100) {
    throw new Error(
      JSON.stringify([{ field: 'name', message: 'El nombre no puede superar 100 caracteres' }]),
    )
  }

  // Verificar unicidad (excepto al actualizar el mismo tenant)
  const existing = await req.payload.find({
    collection: 'tenants',
    where: { name: { equals: name } },
    limit: 1,
  })

  const conflictsWithOther =
    existing.totalDocs > 0 && (operation === 'create' || existing.docs[0]?.id !== data['id'])

  if (conflictsWithOther) {
    throw new Error(
      JSON.stringify([{ field: 'name', message: 'Ya existe un tenant con ese nombre' }]),
    )
  }

  return data
}

export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    useAsTitle: 'name',
    group: 'Plataforma',
  },
  access: {
    // Solo platform_admin puede gestionar tenants
    create: ({ req }) => req.user?.role === 'platform_admin',
    read: ({ req }) => req.user?.role === 'platform_admin',
    update: ({ req }) => req.user?.role === 'platform_admin',
    delete: () => false, // No se elimina, solo se desactiva
  },
  hooks: {
    beforeChange: [validateName],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Onboarding transaccional: configuracion inicial del tenant
          try {
            // El storage folder se crea al subir el primer archivo
            // El acceso al admin panel se habilita automaticamente via el plugin multi-tenant
            req.payload.logger.info({
              msg: 'Tenant onboarding completado',
              tenantId: (doc as Tenant).id,
              tenantName: (doc as Tenant).name,
            })
          } catch (error) {
            req.payload.logger.error({
              msg: 'Error en onboarding de tenant',
              tenantId: (doc as Tenant).id,
              error: error instanceof Error ? error.message : String(error),
            })
            throw error
          }
        }

        if (
          operation === 'update' &&
          !(doc as Tenant).isActive
        ) {
          // Tenant desactivado: invalidar sesiones activas del tenant en <= 5 min
          // La invalidacion ocurre en la siguiente verificacion de sesion (middleware de auth)
          req.payload.logger.info({
            msg: 'Tenant desactivado',
            tenantId: (doc as Tenant).id,
          })
        }
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      minLength: 1,
      maxLength: 100,
      admin: {
        description: 'Nombre único del tenant (1-100 caracteres)',
      },
    },
    {
      name: 'defaultLanguage',
      type: 'text',
      required: true,
      defaultValue: 'es',
      admin: {
        description: 'Código de idioma por defecto (ej: es, en, fr)',
      },
    },
    {
      name: 'timezone',
      type: 'text',
      required: true,
      defaultValue: 'UTC',
      admin: {
        description: 'Zona horaria del tenant (ej: America/Mexico_City)',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Si está desactivado, el sitio público deja de servirse en ≤5 minutos',
      },
    },
    {
      name: 'settings',
      type: 'group',
      fields: [
        {
          name: 'contactEmail',
          type: 'email',
          required: true,
          admin: {
            description: 'Email para recibir notificaciones de formularios de contacto',
          },
        },
        {
          name: 'maxStorageBytes',
          type: 'number',
          required: true,
          defaultValue: MAX_STORAGE_BYTES,
          admin: {
            description: 'Límite de almacenamiento en bytes (default: 5 GB)',
            readOnly: true,
          },
        },
        {
          name: 'currentStorageBytes',
          type: 'number',
          required: true,
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Uso actual de almacenamiento en bytes',
          },
        },
        {
          name: 'captchaEnabled',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Habilitar CAPTCHA en formularios públicos',
          },
        },
        {
          name: 'homePageSlug',
          type: 'text',
          defaultValue: 'home',
          admin: {
            description:
              'Slug de la página de inicio en Pages (ej. home). Se muestra en /es/ sin ese segmento en la URL.',
          },
        },
        {
          name: 'frontendWebhookUrl',
          type: 'text',
          admin: {
            description: 'URL del webhook del frontend para rebuild incremental',
          },
        },
        {
          name: 'frontendWebhookSecret',
          type: 'text',
          admin: {
            description: 'Secreto para firmar webhooks al frontend',
          },
        },
      ],
    },
  ],
}
