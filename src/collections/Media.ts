import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_STORAGE_PER_TENANT_BYTES,
} from '../types/index.ts'

const validateMedia: CollectionBeforeChangeHook = async ({ data, req }) => {
  const mimeType = data['mimeType'] as string | undefined
  const fileSize = data['fileSize'] as number | undefined
  const tenantId = data['tenant']

  // Validar tipo MIME — Property 8
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType as never)) {
    throw new Error(
      JSON.stringify([
        {
          field: 'file',
          message: `Tipo de archivo no permitido: ${mimeType}. Tipos aceptados: JPEG, PNG, WebP, SVG, GIF, PDF, MP4`,
        },
      ]),
    )
  }

  // Validar tamaño maximo (50 MB) — Property 8
  if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      JSON.stringify([
        {
          field: 'file',
          message: `El archivo supera el límite de ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB`,
        },
      ]),
    )
  }

  // Validar cuota de almacenamiento del tenant (5 GB) — Property 8
  if (tenantId && fileSize) {
    const tenant = await req.payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    const settings = tenant['settings'] as {
      currentStorageBytes?: number
      maxStorageBytes?: number
    }

    const currentStorage = settings.currentStorageBytes ?? 0
    const maxStorage = settings.maxStorageBytes ?? MAX_STORAGE_PER_TENANT_BYTES

    if (currentStorage + fileSize > maxStorage) {
      throw new Error(
        JSON.stringify([
          {
            field: 'file',
            message: 'Se ha alcanzado la cuota de almacenamiento del tenant (5 GB)',
          },
        ]),
      )
    }
  }

  // Construir ruta de storage: tenants/{tenant_id}/media/...
  const filename = data['filename'] as string | undefined
  if (tenantId && filename) {
    const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
      mimeType ?? '',
    )
    const subdir = isImage ? 'images' : mimeType === 'video/mp4' ? 'videos' : 'documents'
    data['storagePath'] = `tenants/${tenantId}/media/${subdir}/${filename}`
  }

  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: '/tmp/uploads',
    mimeTypes: ALLOWED_MIME_TYPES,
    imageSizes: [
      // Property 17: variantes responsivas
      { name: 'small', width: 400, height: undefined, position: 'centre' },
      { name: 'medium', width: 800, height: undefined, position: 'centre' },
      { name: 'large', width: 1600, height: undefined, position: 'centre' },
    ],
    formatOptions: {
      format: 'webp', // Convertir a WebP automaticamente
      options: { quality: 85 },
    },
    adminThumbnail: 'small',
  },
  admin: {
    useAsTitle: 'filename',
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
    beforeChange: [validateMedia],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          // Actualizar uso de storage del tenant
          const tenantId = doc['tenant']
          const fileSize = doc['fileSize'] as number
          if (tenantId != null && fileSize) {
            const tenant = await req.payload.findByID({
              collection: 'tenants',
              id: tenantId,
            })
            const settings = tenant['settings'] as { currentStorageBytes?: number }
            const current = settings.currentStorageBytes ?? 0
            await req.payload.update({
              collection: 'tenants',
              id: tenantId,
              data: { settings: { ...settings, currentStorageBytes: current + fileSize } },
            })
          }
        }
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        // Decrementar uso de storage al eliminar archivo
        const tenantId = doc['tenant']
        const fileSize = doc['fileSize'] as number
        if (tenantId != null && fileSize) {
          const tenant = await req.payload.findByID({
            collection: 'tenants',
            id: tenantId,
          })
          const settings = tenant['settings'] as { currentStorageBytes?: number }
          const current = settings.currentStorageBytes ?? 0
          await req.payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
              settings: {
                ...settings,
                currentStorageBytes: Math.max(0, current - fileSize),
              },
            },
          })
        }
      },
    ],
  },
  fields: [
    { name: 'alt', type: 'text', admin: { description: 'Texto alternativo para accesibilidad' } },
    { name: 'mimeType', type: 'text', admin: { readOnly: true } },
    { name: 'fileSize', type: 'number', admin: { readOnly: true } },
    { name: 'storagePath', type: 'text', admin: { readOnly: true } },
    {
      name: 'variants',
      type: 'group',
      fields: [
        { name: 'small', type: 'text' },
        { name: 'medium', type: 'text' },
        { name: 'large', type: 'text' },
      ],
      admin: { readOnly: true },
    },
  ],
}
