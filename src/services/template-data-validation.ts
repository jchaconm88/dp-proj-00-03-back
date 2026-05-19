import type { Payload } from 'payload'
import { parseTemplateManifest, validateTemplateData } from './template-manifest.ts'

export async function loadActiveTemplateManifest(
  payload: Payload,
  tenantId: string,
  templateId: string,
) {
  const result = await payload.find({
    collection: 'html-templates',
    where: {
      and: [
        { tenant: { equals: tenantId } },
        { templateId: { equals: templateId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })

  const doc = result.docs[0]
  if (!doc?.['manifest']) return null
  return parseTemplateManifest(doc['manifest'])
}

export function validatePageTranslationsTemplateData(
  manifest: ReturnType<typeof parseTemplateManifest>,
  translations: unknown,
): void {
  if (!Array.isArray(translations)) return
  for (let i = 0; i < translations.length; i++) {
    const row = translations[i] as Record<string, unknown> | undefined
    if (!row?.['templateData']) continue
    try {
      validateTemplateData(manifest, row['templateData'])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        JSON.stringify([
          {
            field: `translations.${i}.templateData`,
            message: `templateData inválido: ${message}`,
          },
        ]),
      )
    }
  }
}
