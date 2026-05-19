import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'
import fs from 'node:fs/promises'
import path from 'node:path'
import { notifyContentChange } from '../services/webhook.ts'
import { uploadBundle, deleteBundle } from '../services/template-storage.ts'

const ZIP_MIME = ['application/zip', 'application/x-zip-compressed', 'application/octet-stream']

const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/

/** Convierte texto libre a slug válido (ej. "Dsam.pe" → "dsam-pe"). */
function slugifyTemplateId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

const validateTemplateId: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  const name = data['name'] as string | undefined
  let templateId = (data['templateId'] as string | undefined)?.trim()

  if (!templateId && name) {
    templateId = slugifyTemplateId(name)
    data['templateId'] = templateId
  } else if (templateId) {
    templateId = slugifyTemplateId(templateId)
    data['templateId'] = templateId
  }

  const tenantId = data['tenant'] as string | undefined

  if (!templateId) {
    throw new Error(
      JSON.stringify([
        {
          field: 'templateId',
          message: 'Indica un templateId o un nombre para generarlo automáticamente (ej. dsam-pe)',
        },
      ]),
    )
  }

  if (!TEMPLATE_ID_RE.test(templateId)) {
    throw new Error(
      JSON.stringify([
        {
          field: 'templateId',
          message:
            'templateId debe ser slug en minúsculas (a-z, 0-9, guiones). Ejemplo válido: dsam-pe',
        },
      ]),
    )
  }

  if (tenantId && templateId && operation === 'create') {
    const existing = await req.payload.find({
      collection: 'html-templates',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { templateId: { equals: templateId } },
        ],
      },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      throw new Error(
        JSON.stringify([
          {
            field: 'templateId',
            message: 'Ya existe una plantilla con este templateId para el tenant',
          },
        ]),
      )
    }
  }

  if (operation === 'update' && originalDoc && templateId) {
    const docTenant = (data['tenant'] ?? originalDoc['tenant']) as string
    const existing = await req.payload.find({
      collection: 'html-templates',
      where: {
        and: [
          { tenant: { equals: docTenant } },
          { templateId: { equals: templateId } },
          { id: { not_equals: originalDoc['id'] } },
        ],
      },
      limit: 1,
    })
    if (existing.docs.length > 0) {
      throw new Error(
        JSON.stringify([
          {
            field: 'templateId',
            message: 'Ya existe una plantilla con este templateId para el tenant',
          },
        ]),
      )
    }
  }

  return data
}

const extractZipAfterChange: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  if (req.context?.['skipTemplateExtract']) return doc
  if (operation === 'update' && !req.file) return doc

  const tenantRef = doc['tenant']
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
      ? String(tenantRef.id)
      : String(tenantRef)
  const templateId = doc['templateId'] as string
  const filename = doc['filename'] as string | undefined

  if (!filename || !templateId || !tenantId) return doc

  const uploadCandidates = [
    path.join('/tmp/template-uploads', filename),
    path.join(process.cwd(), 'tmp', 'template-uploads', filename),
    path.join(process.cwd(), 'media', filename),
  ]

  let buffer: Buffer | null = null
  for (const filePath of uploadCandidates) {
    try {
      buffer = await fs.readFile(filePath)
      break
    } catch {
      // probar siguiente ruta
    }
  }

  if (!buffer) {
    throw new Error(
      `No se encontró el ZIP subido (${filename}). Rutas probadas: ${uploadCandidates.join(', ')}`,
    )
  }

  try {
    const { bundleSizeBytes, manifest } = await uploadBundle(tenantId, templateId, buffer)
    await req.payload.update({
      collection: 'html-templates',
      id: doc['id'] as string,
      data: { bundleSizeBytes, manifest },
      req,
      context: { skipTemplateExtract: true },
      overrideLock: true,
    })
  } catch (error) {
    console.error('Error extrayendo plantilla ZIP:', error)
    throw error
  }

  if (operation === 'create' || operation === 'update') {
    await notifyContentChange({
      event: 'content.updated',
      tenantId,
      collection: 'html-templates',
      documentId: String(doc['id']),
      timestamp: new Date().toISOString(),
    })
  }

  return doc
}

const afterDeleteCleanup: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const tenantRef = doc['tenant']
  const tenantId =
    typeof tenantRef === 'object' && tenantRef !== null && 'id' in tenantRef
      ? String(tenantRef.id)
      : String(tenantRef)
  const templateId = doc['templateId'] as string

  if (tenantId && templateId) {
    await deleteBundle(tenantId, templateId)
    await notifyContentChange({
      event: 'content.updated',
      tenantId,
      collection: 'html-templates',
      documentId: String(doc['id']),
      timestamp: new Date().toISOString(),
    })
  }

}

export const HtmlTemplates: CollectionConfig = {
  slug: 'html-templates',
  labels: {
    singular: 'Plantilla HTML',
    plural: 'Plantillas HTML',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Contenido',
  },
  upload: {
    staticDir: '/tmp/template-uploads',
    mimeTypes: ZIP_MIME,
    filesRequiredOnCreate: true,
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
    beforeChange: [validateTemplateId],
    afterChange: [extractZipAfterChange],
    afterDelete: [afterDeleteCleanup],
  },
  fields: [
    {
      name: 'templateId',
      type: 'text',
      required: true,
      unique: false,
      admin: {
        description:
          'Identificador único por tenant (ej: dsam-pe). Se normaliza solo: minúsculas, números y guiones. Si lo dejas vacío, se genera desde el nombre.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Activa', value: 'active' },
        { label: 'Archivada', value: 'archived' },
      ],
    },
    {
      name: 'manifest',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Esquema de bloques (template.manifest.json del ZIP)',
      },
    },
    {
      name: 'bundleSizeBytes',
      type: 'number',
      admin: { readOnly: true, description: 'Tamaño total extraído del ZIP' },
    },
    {
      name: 'storagePath',
      type: 'text',
      admin: { readOnly: true },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            const tenantId = siblingData['tenant']
            const templateId = siblingData['templateId']
            if (tenantId && templateId) {
              return `tenants/${tenantId}/templates/${templateId}`
            }
            return siblingData['storagePath']
          },
        ],
      },
    },
  ],
}
