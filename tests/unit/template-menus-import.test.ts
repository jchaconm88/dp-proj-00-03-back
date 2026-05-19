import { describe, it, expect } from 'vitest'
import { parseMenusSeed } from '../../src/services/template-menus-import.ts'

describe('parseMenusSeed', () => {
  it('acepta array de menús', () => {
    const menus = parseMenusSeed([
      {
        location: 'header',
        name: 'Nav',
        items: [{ label: 'Inicio', url: '/' }],
      },
    ])
    expect(menus).toHaveLength(1)
    expect(menus[0]?.location).toBe('header')
  })

  it('rechaza ubicación inválida', () => {
    expect(() =>
      parseMenusSeed([
        {
          location: 'top',
          name: 'X',
          items: [],
        },
      ]),
    ).toThrow(/Ubicación inválida/)
  })
})
