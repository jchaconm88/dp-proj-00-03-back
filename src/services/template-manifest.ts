import { z } from 'zod'

export const MANIFEST_FILENAME = 'template.manifest.json'

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'richText',
  'link',
  'image',
  'array',
  'group',
  'productCatalog',
  'productSlugs',
])

const baseFieldSchema = z.object({
  type: fieldTypeSchema,
  label: z.string().optional(),
  required: z.boolean().optional(),
  /** Obligatorio cuando type === productCatalog */
  category: z.string().optional(),
})

type FieldDef = z.infer<typeof baseFieldSchema> & {
  itemFields?: Record<string, FieldDef>
  fields?: Record<string, FieldDef>
  minItems?: number
  maxItems?: number
}

const fieldDefSchema: z.ZodType<FieldDef> = z.lazy(() =>
  baseFieldSchema.extend({
    itemFields: z.record(fieldDefSchema).optional(),
    fields: z.record(fieldDefSchema).optional(),
    minItems: z.number().int().min(0).optional(),
    maxItems: z.number().int().min(0).optional(),
  }),
)

const blockDefSchema = z.object({
  label: z.string(),
  partial: z.string().min(1),
  fields: z.record(fieldDefSchema),
})

const menuIntegrationSchema = z.object({
  type: z.literal('menu'),
  location: z.enum(['header', 'footer', 'sidebar', 'custom']),
  blockId: z.string().optional(),
})

export const templateManifestSchema = z.object({
  version: z.literal(1),
  globals: z
    .array(z.enum(['title', 'content', 'tenantName', 'lang', 'homeUrl']))
    .default(['title', 'content', 'tenantName', 'lang', 'homeUrl']),
  blocks: z.record(blockDefSchema),
  integrations: z.record(menuIntegrationSchema).optional(),
})

export type TemplateManifest = z.infer<typeof templateManifestSchema>
export type TemplateBlockDef = z.infer<typeof blockDefSchema>
export type TemplateFieldDef = FieldDef

export function parseTemplateManifest(json: unknown): TemplateManifest {
  return templateManifestSchema.parse(json)
}

export function parseTemplateManifestFromBuffer(buffer: Buffer): TemplateManifest {
  const text = buffer.toString('utf-8')
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    throw new Error(`${MANIFEST_FILENAME} no es JSON válido`)
  }
  return parseTemplateManifest(raw)
}

/** Lista rutas de partials referenciados en el manifest. */
export function listPartialPaths(manifest: TemplateManifest): string[] {
  return Object.values(manifest.blocks).map((b) => b.partial.replace(/\\/g, '/'))
}

/** Valida que el ZIP contenga manifest, index y todos los partials. */
export function validateZipEntriesAgainstManifest(
  entryNames: string[],
  manifest: TemplateManifest,
): void {
  const normalized = new Set(
    entryNames.map((n) => n.replace(/\\/g, '/').replace(/^\.\//, '')),
  )

  if (!normalized.has(MANIFEST_FILENAME)) {
    throw new Error(`El ZIP debe incluir ${MANIFEST_FILENAME} en la raíz`)
  }

  const hasIndex = [...normalized].some(
    (n) => n === 'index.html' || n.endsWith('/index.html'),
  )
  if (!hasIndex) {
    throw new Error('El ZIP debe contener index.html')
  }

  for (const partial of listPartialPaths(manifest)) {
    if (!normalized.has(partial)) {
      throw new Error(`Partial no encontrado en el ZIP: ${partial}`)
    }
  }
}

function validationError(message: string, path: string): never {
  throw new Error(JSON.stringify([{ field: path, message }]))
}

function validateFieldValue(
  fieldKey: string,
  def: FieldDef,
  value: unknown,
  path: string,
): void {
  if (value === undefined || value === null) {
    if (def.required) {
      validationError(`Campo obligatorio`, `${path}.${fieldKey}`)
    }
    return
  }

  switch (def.type) {
    case 'text':
    case 'textarea':
    case 'link':
      if (typeof value !== 'string') {
        validationError('Debe ser texto', `${path}.${fieldKey}`)
      }
      break
    case 'richText':
      if (typeof value !== 'string' && (typeof value !== 'object' || value === null)) {
        validationError('Debe ser richText (string u objeto)', `${path}.${fieldKey}`)
      }
      break
    case 'image':
      if (typeof value !== 'object' || value === null) {
        validationError('Debe ser { mediaId: string }', `${path}.${fieldKey}`)
      } else {
        const mediaId = (value as { mediaId?: unknown }).mediaId
        if (mediaId !== undefined && typeof mediaId !== 'string' && typeof mediaId !== 'number') {
          validationError('mediaId inválido', `${path}.${fieldKey}`)
        }
      }
      break
    case 'group': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        validationError('Debe ser un objeto', `${path}.${fieldKey}`)
        break
      }
      const groupFields = def.fields ?? {}
      for (const [k, subDef] of Object.entries(groupFields)) {
        validateFieldValue(k, subDef, (value as Record<string, unknown>)[k], `${path}.${fieldKey}`)
      }
      break
    }
    case 'productCatalog':
      // Marcador de categoría; los ítems vienen de la colección Products
      break
    case 'productSlugs': {
      if (value === undefined || value === null) break
      if (!Array.isArray(value)) {
        validationError('Debe ser un array de slugs', `${path}.${fieldKey}`)
        break
      }
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] !== 'string' || !value[i].trim()) {
          validationError('Cada slug debe ser texto', `${path}.${fieldKey}[${i}]`)
        }
      }
      break
    }
    case 'array': {
      if (!Array.isArray(value)) {
        validationError('Debe ser un array', `${path}.${fieldKey}`)
        break
      }
      if (def.minItems !== undefined && value.length < def.minItems) {
        validationError(`Mínimo ${def.minItems} elementos`, `${path}.${fieldKey}`)
      }
      if (def.maxItems !== undefined && value.length > def.maxItems) {
        validationError(`Máximo ${def.maxItems} elementos`, `${path}.${fieldKey}`)
      }
      const itemFields = def.itemFields ?? {}
      value.forEach((item, i) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          validationError('Cada ítem debe ser un objeto', `${path}.${fieldKey}[${i}]`)
          return
        }
        for (const [k, subDef] of Object.entries(itemFields)) {
          validateFieldValue(k, subDef, (item as Record<string, unknown>)[k], `${path}.${fieldKey}[${i}]`)
        }
      })
      break
    }
    default:
      break
  }
}

/** Valida templateData de una página contra el manifest de su plantilla. */
export function validateTemplateData(
  manifest: TemplateManifest,
  templateData: unknown,
): void {
  if (templateData === undefined || templateData === null) {
    return
  }
  if (typeof templateData !== 'object' || Array.isArray(templateData)) {
    validationError('templateData debe ser un objeto', 'templateData')
  }

  const data = templateData as Record<string, unknown>

  for (const [blockId, blockDef] of Object.entries(manifest.blocks)) {
    const blockValue = data[blockId]
    if (blockValue === undefined || blockValue === null) {
      continue
    }
    if (typeof blockValue !== 'object' || Array.isArray(blockValue)) {
      validationError('Debe ser un objeto', `templateData.${blockId}`)
    }
    for (const [fieldKey, fieldDef] of Object.entries(blockDef.fields)) {
      if (fieldDef.type === 'productCatalog') {
        if (fieldDef.category && !/^[a-z0-9-]+$/.test(fieldDef.category)) {
          validationError('category debe ser slug', `manifest.blocks.${blockId}.${fieldKey}`)
        }
        continue
      }
      if (fieldDef.type === 'productSlugs') {
        validateFieldValue(
          fieldKey,
          fieldDef,
          (blockValue as Record<string, unknown>)[fieldKey],
          `templateData.${blockId}`,
        )
        continue
      }
      if (fieldKey === 'menuLocation') {
        const loc = (blockValue as Record<string, unknown>)[fieldKey]
        if (loc !== undefined && loc !== null && typeof loc !== 'string') {
          validationError('menuLocation debe ser texto', `templateData.${blockId}.menuLocation`)
        }
        continue
      }
      validateFieldValue(
        fieldKey,
        fieldDef,
        (blockValue as Record<string, unknown>)[fieldKey],
        `templateData.${blockId}`,
      )
    }
  }
}
