import { describe, it, expect } from 'vitest'
import { parseProductsSeed } from '../../src/services/template-products-import.ts'

describe('parseProductsSeed', () => {
  it('acepta array válido', () => {
    const items = parseProductsSeed([
      {
        slug: 'a-1',
        category: 'mujer',
        title: 'Demo',
        price: 'S/10',
      },
    ])
    expect(items).toHaveLength(1)
    expect(items[0]?.slug).toBe('a-1')
  })

  it('rechaza categoría inválida', () => {
    expect(() =>
      parseProductsSeed([
        {
          slug: 'x',
          category: 'otros',
          title: 'X',
          price: 'S/1',
        },
      ]),
    ).toThrow(/Categoría inválida/)
  })

  it('rechaza si no es array', () => {
    expect(() => parseProductsSeed({})).toThrow(/array/)
  })
})
