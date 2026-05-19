import type { TemplateBlockDef, TemplateManifest } from './template-manifest.ts'

/** category definida en un campo productCatalog del bloque */
export function getProductCatalogCategory(blockDef: TemplateBlockDef): string | null {
  for (const field of Object.values(blockDef.fields)) {
    if (field.type === 'productCatalog' && field.category) {
      return field.category
    }
  }
  return null
}

export function listCatalogBlocks(manifest: TemplateManifest): Array<{
  blockId: string
  category: string
}> {
  const out: Array<{ blockId: string; category: string }> = []
  for (const [blockId, blockDef] of Object.entries(manifest.blocks)) {
    const category = getProductCatalogCategory(blockDef)
    if (category) out.push({ blockId, category })
  }
  return out
}
