import { describe, it, expect } from 'vitest'
import AdmZip from 'adm-zip'
import {
  parseTemplateManifest,
  validateZipEntriesAgainstManifest,
  validateTemplateData,
  MANIFEST_FILENAME,
} from '../../src/services/template-manifest.ts'

const minimalManifest = {
  version: 1 as const,
  globals: ['title', 'content', 'tenantName', 'lang', 'homeUrl'] as const,
  blocks: {
    hero: {
      label: 'Hero',
      partial: 'partials/hero.html',
      fields: {
        items: {
          type: 'array' as const,
          minItems: 1,
          itemFields: { title: { type: 'text' as const, required: true } },
        },
      },
    },
  },
}

describe('template-manifest', () => {
  it('parsea manifest válido', () => {
    const m = parseTemplateManifest(minimalManifest)
    expect(m.blocks.hero.partial).toBe('partials/hero.html')
  })

  it('rechaza ZIP sin manifest', () => {
    const zip = new AdmZip()
    zip.addFile('index.html', Buffer.from('<html></html>'))
    const names = zip.getEntries().map((e) => e.entryName)
    expect(() => validateZipEntriesAgainstManifest(names, minimalManifest)).toThrow(
      MANIFEST_FILENAME,
    )
  })

  it('acepta campo productCatalog en manifest', () => {
    const m = parseTemplateManifest({
      ...minimalManifest,
      blocks: {
        catalog: {
          label: 'Catálogo',
          partial: 'partials/products.html',
          fields: {
            catalog: { type: 'productCatalog', category: 'mujer' },
            heading: { type: 'text' },
          },
        },
      },
    })
    expect(m.blocks.catalog.fields.catalog.type).toBe('productCatalog')
  })

  it('valida templateData de bloques', () => {
    validateTemplateData(minimalManifest, {
      hero: { items: [{ title: 'A' }] },
    })
    expect(() =>
      validateTemplateData(minimalManifest, {
        hero: { items: [{}] },
      }),
    ).toThrow()
  })

  it('valida productSlugs como array de strings', () => {
    const manifest = parseTemplateManifest({
      version: 1,
      blocks: {
        cat: {
          label: 'Cat',
          partial: 'p.html',
          fields: {
            productSlugs: { type: 'productSlugs' },
          },
        },
      },
    })
    validateTemplateData(manifest, { cat: { productSlugs: ['a', 'b'] } })
    expect(() =>
      validateTemplateData(manifest, { cat: { productSlugs: [1] } }),
    ).toThrow()
  })
})
